import { supabase } from "@/services/supabaseClient";
import type { Colaborador } from "@/types/domain";

const SELECT_COLUNAS =
  "id, filial_id, lider_id, matricula, nome, cargo, tipo_contrato, ativo, cep, latitude, longitude, localizacao_precisao, filiais(nome), lider:perfis!lider_id(nome)";

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

/**
 * 'exata'  — rua (+bairro) resolvidos.
 * 'bairro' — só o bairro foi localizado.
 * 'cidade' — só o centro da cidade (grosseiro demais pro alerta de
 *            proximidade — checkin-publico ignora esse nível).
 * 'manual' — usuário ajustou o pino manualmente no mapa.
 */
export type PrecisaoGeocodificacao = "exata" | "bairro" | "cidade" | "manual";

export interface CoordenadaGeocodificada {
  latitude: number;
  longitude: number;
  precisao: PrecisaoGeocodificacao;
}

function normalizarTexto(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

async function buscarNominatim(query: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
    if (!resp.ok) return null;
    const resultados = await resp.json();
    if (!Array.isArray(resultados) || resultados.length === 0) return null;
    const latitude = Number(resultados[0].lat);
    const longitude = Number(resultados[0].lon);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

const LOCATIONIQ_TOKEN = import.meta.env.VITE_LOCATIONIQ_TOKEN as string | undefined;

/**
 * LocationIQ — provedor pago (chave própria, plano gratuito com cota diária)
 * com cobertura bem melhor de endereços novos/informais no Brasil do que os
 * gratuitos sem chave. Só entra na cascata se a variável de ambiente
 * VITE_LOCATIONIQ_TOKEN estiver configurada; sem ela, esse passo é pulado
 * silenciosamente (o resto da cascata continua funcionando).
 */
async function buscarLocationIQ(query: string): Promise<{ latitude: number; longitude: number } | null> {
  if (!LOCATIONIQ_TOKEN) return null;
  try {
    const resp = await fetch(
      `https://us1.locationiq.com/v1/search.php?key=${LOCATIONIQ_TOKEN}&format=json&limit=1&q=${encodeURIComponent(query)}`
    );
    if (!resp.ok) return null;
    const resultados = await resp.json();
    if (!Array.isArray(resultados) || resultados.length === 0) return null;
    const latitude = Number(resultados[0].lat);
    const longitude = Number(resultados[0].lon);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

/**
 * Segundo provedor gratuito (Photon/Komoot), usado só quando o Nominatim não
 * acha nada. Sem viés de local, o Photon pode devolver uma rua de mesmo nome
 * em outro município (testado: "Rua das Orquídeas" voltou em Cajamar e Santa
 * Bárbara d'Oeste pra uma busca de endereço em São Paulo) — por isso só
 * aceita o resultado se a cidade dele bater com a cidade esperada do CEP.
 */
async function buscarPhoton(
  query: string,
  cidadeEsperada: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const resp = await fetch(`https://photon.komoot.io/api/?limit=5&q=${encodeURIComponent(query)}`);
    if (!resp.ok) return null;
    const json = await resp.json();
    const features = Array.isArray(json.features) ? json.features : [];
    const alvo = normalizarTexto(cidadeEsperada);
    const match = features.find((f: { properties?: { city?: string } }) => normalizarTexto(f.properties?.city ?? "") === alvo);
    if (!match) return null;
    const [longitude, latitude] = match.geometry.coordinates;
    if (typeof latitude !== "number" || typeof longitude !== "number") return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

/**
 * CEP -> coordenada. ViaCEP resolve o CEP num endereço legível (confiável
 * especificamente pra CEP brasileiro), depois tenta geocodificar esse
 * endereço em ordem decrescente de qualidade: Nominatim (grátis, rua+bairro
 * -> rua -> bairro) -> LocationIQ (pago com cota grátis, só se
 * VITE_LOCATIONIQ_TOKEN estiver configurado — cobre bem endereços novos/
 * informais que os provedores sem chave não têm indexados) -> Photon (outro
 * provedor grátis) -> centro da cidade como último recurso. Nunca falha o
 * cadastro por falta de indexação de mapa, mas deixa registrado em qual
 * nível a coordenada foi encontrada (`precisao`), pra quem for usar o dado
 * saber o quão confiável ela é (ex.: checkin-publico ignora 'cidade').
 *
 * Retorna null só se o CEP for inválido/inexistente — nunca lança erro.
 */
export async function geocodificarCep(cep: string): Promise<CoordenadaGeocodificada | null> {
  const cepLimpo = cep.replace(/\D/g, "");
  if (cepLimpo.length !== 8) return null;

  const respViaCep = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`).catch(() => null);
  if (!respViaCep?.ok) return null;
  const endereco = await respViaCep.json();
  if (endereco.erro) return null;

  const { logradouro, bairro, localidade, uf } = endereco;
  const dedup = new Set<string>();
  const juntar = (partes: (string | undefined)[]) => partes.filter(Boolean).join(", ");

  const tentativasNominatim: { query: string; precisao: PrecisaoGeocodificacao }[] = [
    { query: juntar([logradouro, bairro, localidade, uf, "Brasil"]), precisao: "exata" },
    { query: juntar([logradouro, localidade, uf, "Brasil"]), precisao: "exata" },
    { query: juntar([bairro, localidade, uf, "Brasil"]), precisao: "bairro" },
  ];
  for (const t of tentativasNominatim) {
    if (!t.query || dedup.has(t.query)) continue;
    // Respeita o limite de 1 req/s do Nominatim entre tentativas dentro da
    // mesma cascata (só espera a partir da 2ª chamada).
    if (dedup.size > 0) await new Promise((r) => setTimeout(r, 1100));
    dedup.add(t.query);
    const coordenada = await buscarNominatim(t.query);
    if (coordenada) return { ...coordenada, precisao: t.precisao };
  }

  if (LOCATIONIQ_TOKEN && localidade) {
    const tentativasLocationIQ: { query: string; precisao: PrecisaoGeocodificacao }[] = [
      { query: juntar([logradouro, bairro, localidade, uf, "Brasil"]), precisao: "exata" },
      { query: juntar([bairro, localidade, uf, "Brasil"]), precisao: "bairro" },
    ];
    for (const t of tentativasLocationIQ) {
      if (!t.query) continue;
      const coordenada = await buscarLocationIQ(t.query);
      if (coordenada) return { ...coordenada, precisao: t.precisao };
    }
  }

  if (localidade) {
    const tentativasPhoton: { query: string; precisao: PrecisaoGeocodificacao }[] = [
      { query: juntar([logradouro, bairro, localidade, uf]), precisao: "exata" },
      { query: juntar([bairro, localidade, uf]), precisao: "bairro" },
    ];
    for (const t of tentativasPhoton) {
      if (!t.query || dedup.has(t.query)) continue;
      dedup.add(t.query);
      const coordenada = await buscarPhoton(t.query, localidade);
      if (coordenada) return { ...coordenada, precisao: t.precisao };
    }

    // Último recurso: centro da cidade. Nunca falha o cadastro, mas é
    // grosseiro demais pro alerta de proximidade de 2km.
    if (dedup.size > 0) await new Promise((r) => setTimeout(r, 1100));
    const coordenadaCidade = await buscarNominatim(juntar([localidade, uf, "Brasil"]));
    if (coordenadaCidade) return { ...coordenadaCidade, precisao: "cidade" };
  }

  return null;
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
      localizacao_precisao: coordenada?.precisao ?? null,
    })
    .select(SELECT_COLUNAS)
    .single();

  if (error) throw error;
  return mapearLinha(data as unknown as ColaboradorRowBruta);
}

export async function atualizarColaborador(
  id: string,
  dados: Partial<
    Pick<Colaborador, "nome" | "cargo" | "lider_id" | "ativo" | "cep" | "latitude" | "longitude" | "localizacao_precisao">
  >
) {
  const { data, error } = await supabase.from("colaboradores").update(dados).eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Você não tem permissão para alterar este colaborador.");
  }
}

/** Cadastra/troca o CEP residencial de um colaborador já existente, geocodificando de novo. */
export async function atualizarCepColaborador(id: string, cep: string): Promise<CoordenadaGeocodificada | null> {
  const coordenada = await geocodificarCep(cep);
  await atualizarColaborador(id, {
    cep,
    latitude: coordenada?.latitude ?? null,
    longitude: coordenada?.longitude ?? null,
    localizacao_precisao: coordenada?.precisao ?? null,
  });
  return coordenada;
}

/** Ajusta manualmente a coordenada (arrastando o pino no mapa) — usado quando a geocodificação automática não foi precisa o bastante. */
export async function atualizarCoordenadaManual(id: string, latitude: number, longitude: number) {
  await atualizarColaborador(id, { latitude, longitude, localizacao_precisao: "manual" });
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
