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
}

/**
 * Cria um colaborador (sem login próprio). filial_id é herdado automaticamente
 * da filial "home" do líder direto escolhido — o formulário não pede filial.
 */
export async function criarColaborador(input: NovoColaboradorInput): Promise<Colaborador> {
  const { data: lider, error: erroLider } = await supabase
    .from("perfis")
    .select("filial_id")
    .eq("id", input.liderId)
    .single();
  if (erroLider) throw erroLider;
  if (!lider.filial_id) {
    throw new Error("O líder selecionado não tem uma filial de origem definida — ajuste isso em Usuários antes de continuar.");
  }

  const { data, error } = await supabase
    .from("colaboradores")
    .insert({
      nome: input.nome,
      matricula: input.matricula,
      cargo: input.cargo,
      lider_id: input.liderId,
      filial_id: lider.filial_id,
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
