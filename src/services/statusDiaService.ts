import { supabase } from "@/services/supabaseClient";
import { transicionar, type EventoStatusDia } from "@/lib/statusMachine";
import type { StatusDiaRegistro } from "@/types/status";

const SELECT_COLUNAS =
  "id, colaborador_id, filial_id, data_referencia, tipo_dia, status, registro_presenca_id, motivo_outros, observacao, decidido_por, decidido_em, created_at, updated_at, colaboradores(nome, matricula), filiais(nome)";

function mapearLinha(row: any): StatusDiaRegistro {
  return {
    ...row,
    colaborador_nome: row.colaboradores?.nome,
    colaborador_matricula: row.colaboradores?.matricula,
    filial_nome: row.filiais?.nome,
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
  return data ? mapearLinha(data) : null;
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
  return (data ?? []).map(mapearLinha);
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
