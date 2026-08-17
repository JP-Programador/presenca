import { supabase } from "@/services/supabaseClient";
import type { Colaborador } from "@/types/domain";

const SELECT_COLUNAS =
  "id, filial_id, lider_id, matricula, nome, cargo, tipo_contrato, ativo, cep, latitude, longitude, filiais(nome), lider:perfis!lider_id(nome)";

interface ColaboradorRowBruta extends Omit<Colaborador, "filial_nome" | "lider_nome"> {
  filiais: { nome: string } | null;
  lider: { nome: string } | null;
}

function mapearLinha(row: ColaboradorRowBruta): Colaborador {
  return {
    ...row,
    filial_nome: row.filiais?.nome,
    lider_nome: row.lider?.nome,
  };
}

/** Colaboradores visíveis pelo usuário atual (RLS: líder só vê os seus, coordenador/admin veem todos). */
export async function listarColaboradores(): Promise<Colaborador[]> {
  const { data, error } = await supabase.from("colaboradores").select(SELECT_COLUNAS).order("nome");
  if (error) throw error;
  // O cliente Supabase não consegue inferir o tipo do join a partir da string do
  // select (database.types.ts é um placeholder sem Relationships reais — ver
  // comentário no arquivo); o formato da linha é garantido pela query acima.
  return ((data ?? []) as unknown as ColaboradorRowBruta[]).map(mapearLinha);
}

/** Total de colaboradores ativos visíveis pelo usuário atual (efetivo escalado do dia) — mesma RLS de listarColaboradores. */
export async function contarColaboradoresAtivos(): Promise<number> {
  const { count, error } = await supabase
    .from("colaboradores")
    .select("id", { count: "exact", head: true })
    .eq("ativo", true);
  if (error) throw error;
  return count ?? 0;
}

export interface NovoColaboradorInput {
  nome: string;
  matricula: string;
  cargo: string;
  liderId: string;
  filialId: string;
  /** CEP residencial (opcional) — geocodificado antes de salvar, vira a base do alerta de check-in perto de casa. */
  cep?: string;
}

interface CoordenadaGeocodificada {
  latitude: number;
  longitude: number;
}

/**
 * CEP -> coordenada, em duas etapas gratuitas e sem chave: ViaCEP resolve
 * o CEP num endereço legível (mais confiável pra CEP brasileiro do que
 * mandar o CEP puro pro geocoder), e o Nominatim (OpenStreetMap) converte
 * esse endereço em lat/long. Retorna null se o CEP for inválido ou
 * qualquer uma das chamadas falhar — nunca lança erro, pra não travar o
 * cadastro do colaborador por causa disso.
 */
export async function geocodificarCep(cep: string): Promise<CoordenadaGeocodificada | null> {
  const cepLimpo = cep.replace(/\D/g, "");
  if (cepLimpo.length !== 8) return null;

  try {
    const respViaCep = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    if (!respViaCep.ok) return null;
    const endereco = await respViaCep.json();
    if (endereco.erro) return null;

    const query = [endereco.logradouro, endereco.bairro, endereco.localidade, endereco.uf, "Brasil"]
      .filter(Boolean)
      .join(", ");

    const respNominatim = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
    );
    if (!respNominatim.ok) return null;
    const resultados = await respNominatim.json();
    if (!Array.isArray(resultados) || resultados.length === 0) return null;

    const latitude = Number(resultados[0].lat);
    const longitude = Number(resultados[0].lon);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

/** Cria um colaborador (sem login próprio) na filial escolhida no formulário. */
export async function criarColaborador(input: NovoColaboradorInput): Promise<Colaborador> {
  const coordenada = input.cep ? await geocodificarCep(input.cep) : null;

  const { data, error } = await supabase
    .from("colaboradores")
    .insert({
      nome: input.nome,
      matricula: input.matricula,
      cargo: input.cargo,
      lider_id: input.liderId,
      filial_id: input.filialId,
      cep: input.cep || null,
      latitude: coordenada?.latitude ?? null,
      longitude: coordenada?.longitude ?? null,
    })
    .select(SELECT_COLUNAS)
    .single();

  if (error) throw error;
  return mapearLinha(data as unknown as ColaboradorRowBruta);
}

export async function atualizarColaborador(
  id: string,
  dados: Partial<Pick<Colaborador, "nome" | "cargo" | "lider_id" | "ativo" | "cep" | "latitude" | "longitude">>
) {
  const { data, error } = await supabase.from("colaboradores").update(dados).eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Você não tem permissão para alterar este colaborador.");
  }
}

/** Cadastra/troca o CEP residencial de um colaborador já existente, geocodificando de novo. */
export async function atualizarCepColaborador(id: string, cep: string) {
  const coordenada = await geocodificarCep(cep);
  await atualizarColaborador(id, {
    cep,
    latitude: coordenada?.latitude ?? null,
    longitude: coordenada?.longitude ?? null,
  });
  return coordenada;
}

/**
 * Exclusão permanente (hard delete) — só funciona com o colaborador já
 * inativo (RLS exige `ativo=false`) e admin/gerente. Apaga em cascata todo
 * o histórico ligado a ele (registros_presenca, justificativas,
 * marcacoes_dia, status_dia, alertas) — irreversível.
 */
export async function excluirColaboradorPermanentemente(id: string) {
  const { data, error } = await supabase.from("colaboradores").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Você não tem permissão para excluir este colaborador (ele precisa estar inativo).");
  }
}
