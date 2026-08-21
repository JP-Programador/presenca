import { supabase } from "@/services/supabaseClient";
import type { LinhaRelatorioAtendimento, LinhaRelatorioPresenca } from "@/types/relatorios";
import type { AuditLogEntry } from "@/types/domain";

export interface FiltroRelatorio {
  inicio: string; // data_referencia >=
  fim: string; // data_referencia <=
  filialId?: string;
  liderNome?: string; // filtra client-side (lider_nome é um string_agg, não dá pra usar .eq no banco)
  apenasPendencias?: boolean;
}

/** Base de todos os relatórios de presença do Módulo 12 — filtra a view vw_relatorio_presenca. */
export async function listarRelatorioPresenca(
  filtro: FiltroRelatorio
): Promise<LinhaRelatorioPresenca[]> {
  let query = supabase
    .from("vw_relatorio_presenca")
    .select(
      "status_dia_id, data_referencia, colaborador_matricula, colaborador_nome, filial_id, filial_nome, lider_nome, status_final, hora_envio, hora_aprovacao, aprovado_por, motivo, observacao, latitude, longitude"
    )
    .gte("data_referencia", filtro.inicio)
    .lte("data_referencia", filtro.fim)
    .order("data_referencia", { ascending: false });

  if (filtro.filialId) query = query.eq("filial_id", filtro.filialId);
  if (filtro.apenasPendencias) query = query.eq("status_final", "PENDENTE");

  const { data, error } = await query;
  if (error) throw error;

  let linhas = (data ?? []) as LinhaRelatorioPresenca[];
  if (filtro.liderNome) {
    linhas = linhas.filter((l) => l.lider_nome?.includes(filtro.liderNome!));
  }
  return linhas;
}

/** Relatório "por coordenador": mesma base, mas só linhas decididas por um perfil coordenador/admin. */
export async function listarRelatorioPorCoordenador(
  filtro: FiltroRelatorio
): Promise<LinhaRelatorioPresenca[]> {
  const [todas, { data: coordenadores }] = await Promise.all([
    listarRelatorioPresenca(filtro),
    supabase.from("perfis").select("id").in("perfil", ["coordenador", "admin"]),
  ]);
  const idsCoordenadores = new Set((coordenadores ?? []).map((p: { id: string }) => p.id));
  return todas.filter((l) => l.aprovado_por && idsCoordenadores.has(l.aprovado_por));
}

/** Histórico de chegada/saída de atendimento (visita a cliente) no período — independente da presença. */
/**
 * Histórico de atendimento (entrada + saída, já emparelhadas): só entradas
 * de colaboradores cujo líder exige saída de atendimento — presença comum
 * de times "somente presença" não entra aqui, tem seu próprio relatório.
 */
export async function listarRelatorioAtendimentos(
  inicioISO: string,
  fimISO: string
): Promise<LinhaRelatorioAtendimento[]> {
  const { data: lideresComSaida, error: erroLideres } = await supabase
    .from("perfis")
    .select("id")
    .eq("perfil", "gestor")
    .eq("exige_saida_atendimento", true);
  if (erroLideres) throw erroLideres;

  const liderIds = (lideresComSaida ?? []).map((l) => l.id);
  if (liderIds.length === 0) return [];

  const { data, error } = await supabase
    .from("registros_presenca")
    .select(
      "id, data_referencia, horario_registrado, endereco_completo, colaboradores!inner(nome, matricula, lider_id, lider:perfis!lider_id(nome)), marcacoes_atendimento!registro_presenca_entrada_id(data_referencia, horario_registrado, endereco_completo, status_aprovacao)"
    )
    .eq("tipo", "entrada")
    .in("colaboradores.lider_id", liderIds)
    .gte("data_referencia", inicioISO)
    .lte("data_referencia", fimISO)
    .order("horario_registrado", { ascending: false });

  if (error) throw error;

  interface LinhaBruta {
    id: string;
    data_referencia: string;
    horario_registrado: string;
    endereco_completo: string | null;
    colaboradores: { nome: string; matricula: string; lider: { nome: string } | null } | null;
    marcacoes_atendimento: {
      data_referencia: string;
      horario_registrado: string;
      endereco_completo: string | null;
      status_aprovacao: "pendente" | "aprovado" | "rejeitado";
    } | null;
  }

  const linhas = (data ?? []) as unknown as LinhaBruta[];
  const idsEntrada = linhas.map((l) => l.id);

  // Contagem de alertas de fechamento por entrada — detalhes.registro_presenca_id
  // é jsonb (não FK), então não dá pra embutir via join do PostgREST.
  const { data: alertasAtendimento } = await supabase
    .from("alertas")
    .select("detalhes")
    .in("tipo", ["atendimento_pendente_fechamento", "atendimento_sem_fechamento"]);
  const contagemAlertas = new Map<string, number>();
  for (const a of (alertasAtendimento ?? []) as { detalhes: { registro_presenca_id?: string } }[]) {
    const id = a.detalhes?.registro_presenca_id;
    if (id && idsEntrada.includes(id)) contagemAlertas.set(id, (contagemAlertas.get(id) ?? 0) + 1);
  }

  return linhas.map((row) => {
    const saida = row.marcacoes_atendimento;
    const tempoTotalMin = saida
      ? Math.round((new Date(saida.horario_registrado).getTime() - new Date(row.horario_registrado).getTime()) / 60000)
      : null;

    let status: LinhaRelatorioAtendimento["status"] = "aberto";
    if (saida?.status_aprovacao === "aprovado") status = "fechado";
    else if (saida?.status_aprovacao === "rejeitado") status = "saida_rejeitada";
    else if (saida?.status_aprovacao === "pendente") status = "pendente_aprovacao_saida";

    return {
      registro_presenca_id: row.id,
      colaborador_nome: row.colaboradores?.nome ?? "",
      colaborador_matricula: row.colaboradores?.matricula ?? "",
      lider_nome: row.colaboradores?.lider?.nome ?? null,
      data_entrada: row.data_referencia,
      hora_entrada: row.horario_registrado,
      endereco_entrada: row.endereco_completo,
      data_saida: saida?.data_referencia ?? null,
      hora_saida: saida?.horario_registrado ?? null,
      endereco_saida: saida?.endereco_completo ?? null,
      tempo_total_min: tempoTotalMin,
      status,
      alertas_gerados: contagemAlertas.get(row.id) ?? 0,
    };
  });
}

/**
 * Rejeições: status_dia não guarda um estado "rejeitado" próprio (ele volta
 * para FALTA/FOLGA) — por isso o relatório busca no audit_log a transição
 * específica PENDENTE -> FALTA/FOLGA, que é o que uma rejeição sempre gera.
 */
export async function listarRejeicoes(inicioISO: string, fimISO: string): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, ator_id, acao, entidade, entidade_id, detalhes, created_at, perfis(nome)")
    .eq("acao", "status_dia_alterado")
    .eq("detalhes->>de", "PENDENTE")
    .gte("created_at", `${inicioISO}T00:00:00`)
    .lte("created_at", `${fimISO}T23:59:59`)
    .order("created_at", { ascending: false });

  if (error) throw error;

  type LinhaBruta = Omit<AuditLogEntry, "ator_nome" | "detalhes"> & {
    detalhes: { de?: string; para?: string } & Record<string, unknown>;
    perfis: { nome: string } | null;
  };

  return ((data ?? []) as unknown as LinhaBruta[])
    .filter((row) => row.detalhes?.para === "FALTA" || row.detalhes?.para === "FOLGA")
    .map((row) => ({ ...row, ator_nome: row.perfis?.nome ?? "Sistema" }));
}
