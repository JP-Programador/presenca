import { supabase } from "@/services/supabaseClient";
import type { Colaborador } from "@/types/domain";

const SELECT_COLUNAS =
  "id, filial_id, lider_id, matricula, nome, cargo, tipo_contrato, ativo, filiais(nome), lider:perfis!lider_id(nome)";

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

export interface NovoColaboradorInput {
  nome: string;
  matricula: string;
  cargo: string;
  liderId: string;
  filialId: string;
}

/** Cria um colaborador (sem login próprio) na filial escolhida no formulário. */
export async function criarColaborador(input: NovoColaboradorInput): Promise<Colaborador> {
  const { data, error } = await supabase
    .from("colaboradores")
    .insert({
      nome: input.nome,
      matricula: input.matricula,
      cargo: input.cargo,
      lider_id: input.liderId,
      filial_id: input.filialId,
    })
    .select(SELECT_COLUNAS)
    .single();

  if (error) throw error;
  return mapearLinha(data as unknown as ColaboradorRowBruta);
}

export async function atualizarColaborador(
  id: string,
  dados: Partial<Pick<Colaborador, "nome" | "cargo" | "lider_id" | "ativo">>
) {
  const { data, error } = await supabase.from("colaboradores").update(dados).eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Você não tem permissão para alterar este colaborador.");
  }
}
