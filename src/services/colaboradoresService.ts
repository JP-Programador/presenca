import { supabase } from "@/services/supabaseClient";
import type { Colaborador } from "@/types/domain";

const SELECT_COLUNAS =
  "id, filial_id, lider_id, matricula, nome, cargo, tipo_contrato, ativo, filiais(nome), lider:perfis!lider_id(nome)";

function mapearLinha(row: any): Colaborador {
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
  return (data ?? []).map(mapearLinha);
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
  return mapearLinha(data);
}

export async function atualizarColaborador(
  id: string,
  dados: Partial<Pick<Colaborador, "nome" | "cargo" | "lider_id" | "ativo">>
) {
  const { error } = await supabase.from("colaboradores").update(dados).eq("id", id);
  if (error) throw error;
}
