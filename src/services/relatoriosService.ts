import { supabase } from "@/services/supabaseClient";
import type { LinhaRelatorioPresenca } from "@/types/relatorios";
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
