import { supabase } from "@/services/supabaseClient";
import { transicionar, type EventoStatusDia } from "@/lib/statusMachine";
import type { StatusDiaRegistro } from "@/types/status";

const SELECT_COLUNAS =
  "id, colaborador_id, filial_id, data_referencia, tipo_dia, status, registro_presenca_id, motivo_outros, observacao, decidido_por, decidido_em, created_at, updated_at, colaboradores(nome, matricula), filiais(nome), registros_presenca(foto_path)";

interface StatusDiaRowBruta
  extends Omit<
    StatusDiaRegistro,
    "colaborador_nome" | "colaborador_matricula" | "filial_nome" | "decidido_por_nome" | "foto_path"
  > {
  colaboradores: { nome: string; matricula: string } | null;
  filiais: { nome: string } | null;
  registros_presenca: { foto_path: string | null } | null;
}

function mapearLinha(row: StatusDiaRowBruta): StatusDiaRegistro {
  return {
    ...row,
    colaborador_nome: row.colaboradores?.nome,
    colaborador_matricula: row.colaboradores?.matricula,
    filial_nome: row.filiais?.nome,
    foto_path: row.registros_presenca?.foto_path ?? null,
  };
}

/** Busca (sem criar) o status do dia de um colaborador numa data. */
export async function buscarStatusDia(
  colaboradorId: string,
  dataISO: string
): Promise<StatusDiaRegistro | null> {
  const { data, error } = await supabase
    .from("status_dia")
    .select(SELECT_COLUNAS)
    .eq("colaborador_id", colaboradorId)
    .eq("data_referencia", dataISO)
    .maybeSingle();

  if (error) throw error;
  // O cliente Supabase não infere o tipo do join a partir da string do select
  // (database.types.ts é um placeholder sem Relationships reais); o formato
  // da linha é garantido pela query acima.
  return data ? mapearLinha(data as unknown as StatusDiaRowBruta) : null;
}

/** Garante que a linha do dia existe (cria FALTA/FOLGA se necessário) e a retorna. */
export async function obterOuCriarStatusDia(
  colaboradorId: string,
  dataISO: string
): Promise<StatusDiaRegistro> {
  const { data, error } = await supabase.rpc("obter_ou_criar_status_dia", {
    p_colaborador_id: colaboradorId,
    p_data: dataISO,
  });
  if (error) throw error;
  return data as StatusDiaRegistro;
}

/** Lista os status do dia de uma data, com filtro opcional por filial. */
export async function listarStatusDia(
  dataISO: string,
  filialId?: string
): Promise<StatusDiaRegistro[]> {
  let query = supabase.from("status_dia").select(SELECT_COLUNAS).eq("data_referencia", dataISO);
  if (filialId) query = query.eq("filial_id", filialId);

  const { data, error } = await query.order("status", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as StatusDiaRowBruta[]).map(mapearLinha);
}

/** Lista os status do dia de um período (ex.: um mês inteiro), com filtro opcional por filial — base da tabela mensal em grade. */
export async function listarStatusDiaPeriodo(
  inicioISO: string,
  fimISO: string,
  filialId?: string
): Promise<StatusDiaRegistro[]> {
  let query = supabase
    .from("status_dia")
    .select(SELECT_COLUNAS)
    .gte("data_referencia", inicioISO)
    .lte("data_referencia", fimISO);
  if (filialId) query = query.eq("filial_id", filialId);

  const { data, error } = await query.order("data_referencia", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as StatusDiaRowBruta[]).map(mapearLinha);
}

/**
 * Aplica uma transição de estado, validando localmente (feedback imediato)
 * antes de chamar a função transacional do banco (tlp_presenca.transicionar_status_dia),
 * que é a fonte de verdade da regra.
 */
export async function aplicarEvento(
  statusAtual: StatusDiaRegistro,
  evento: EventoStatusDia
): Promise<StatusDiaRegistro> {
  const novoStatus = transicionar(statusAtual.status, statusAtual.tipo_dia, evento);

  const { data, error } = await supabase.rpc("transicionar_status_dia", {
    p_id: statusAtual.id,
    p_novo_status: novoStatus,
    p_registro_presenca_id: null,
    p_motivo_outros: evento.tipo === "MARCAR_MANUAL" ? evento.motivoOutros ?? null : null,
    p_observacao: evento.tipo === "MARCAR_MANUAL" ? evento.observacao ?? null : null,
  });

  if (error) throw error;
  return data as StatusDiaRegistro;
}
