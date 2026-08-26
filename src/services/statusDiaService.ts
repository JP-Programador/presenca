import { supabase } from "@/services/supabaseClient";
import { transicionar, type EventoStatusDia } from "@/lib/statusMachine";
import type { StatusDiaRegistro } from "@/types/status";

const SELECT_COLUNAS =
  "id, colaborador_id, filial_id, data_referencia, tipo_dia, status, registro_presenca_id, motivo_outros, observacao, decidido_por, decidido_em, created_at, updated_at, colaboradores(nome, matricula, lider:perfis!lider_id(nome)), filiais(nome), registros_presenca(foto_path)";

// Mesmas colunas, mas com colaboradores!inner + ativo — usada nas listagens
// (pendências/dashboards), pra excluir colaboradores desligados: uma vez
// desativado, ninguém deveria ver o status dele nessas telas.
const SELECT_COLUNAS_ATIVOS =
  "id, colaborador_id, filial_id, data_referencia, tipo_dia, status, registro_presenca_id, motivo_outros, observacao, decidido_por, decidido_em, created_at, updated_at, colaboradores!inner(nome, matricula, ativo, lider:perfis!lider_id(nome)), filiais(nome), registros_presenca(foto_path)";

interface StatusDiaRowBruta
  extends Omit<
    StatusDiaRegistro,
    "colaborador_nome" | "colaborador_matricula" | "filial_nome" | "decidido_por_nome" | "foto_path" | "lider_nome"
  > {
  colaboradores: { nome: string; matricula: string; lider: { nome: string } | null } | null;
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
    lider_nome: row.colaboradores?.lider?.nome ?? null,
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
  let query = supabase
    .from("status_dia")
    .select(SELECT_COLUNAS_ATIVOS)
    .eq("data_referencia", dataISO)
    .eq("colaboradores.ativo", true);
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
    .select(SELECT_COLUNAS_ATIVOS)
    .gte("data_referencia", inicioISO)
    .lte("data_referencia", fimISO)
    .eq("colaboradores.ativo", true);
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
    // Marcação manual do líder: o status escolhido vale como está (não deixa
    // o servidor recalcular FALTA/FOLGA pro "repouso" do dia — isso é só pra
    // rejeição automática).
    p_forcar_status: evento.tipo === "MARCAR_MANUAL",
  });

  if (error) throw error;
  return data as StatusDiaRegistro;
}

export interface PreviewFerias {
  data_referencia: string;
  conflito: boolean;
  aplicado: boolean;
}

/**
 * Aplica férias num intervalo de datas. Sem sobrescrever=true, se algum dia
 * já tiver registro (check-in real ou status manual diferente do padrão),
 * nada é aplicado — o retorno traz o preview com os dias em conflito pro
 * front perguntar se deve sobrescrever.
 */
export async function aplicarFerias(
  colaboradorId: string,
  dataInicio: string,
  dataFim: string,
  observacao: string,
  sobrescrever = false
): Promise<PreviewFerias[]> {
  const { data, error } = await supabase.rpc("aplicar_ferias", {
    p_colaborador_id: colaboradorId,
    p_data_inicio: dataInicio,
    p_data_fim: dataFim,
    p_observacao: observacao || null,
    p_sobrescrever: sobrescrever,
  });
  if (error) throw error;
  return data as PreviewFerias[];
}

/**
 * Janela de datas usada pra "Cancelar férias" a partir de um único dia
 * visível na tela: como o período completo não fica guardado em nenhum
 * lugar (só cada dia sabe que está em Férias), abrange uma folga generosa
 * em torno do dia clicado — cancelar_ferias só mexe nos dias que
 * realmente estão marcados como Férias dentro dela, o resto é ignorado.
 */
export function janelaCancelamentoFerias(dataReferenciaISO: string): { inicio: string; fim: string } {
  const base = new Date(`${dataReferenciaISO}T00:00:00`);
  const inicio = new Date(base);
  inicio.setDate(inicio.getDate() - 60);
  const fim = new Date(base);
  fim.setDate(fim.getDate() + 60);
  return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
}

/** Cancela férias num intervalo — reverte os dias marcados como Outros/Férias pro status padrão (Falta/Folga). */
export async function cancelarFerias(colaboradorId: string, dataInicio: string, dataFim: string): Promise<void> {
  const { error } = await supabase.rpc("cancelar_ferias", {
    p_colaborador_id: colaboradorId,
    p_data_inicio: dataInicio,
    p_data_fim: dataFim,
  });
  if (error) throw error;
}
