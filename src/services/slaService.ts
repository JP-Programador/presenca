import { supabase } from "@/services/supabaseClient";
import type { SlaStatusDia } from "@/types/status";

/** Decisões de status_dia concluídas num intervalo (padrão: últimos 30 dias). */
export async function listarSlaStatusDia(
  inicioISO?: string,
  fimISO?: string
): Promise<SlaStatusDia[]> {
  let query = supabase
    .from("vw_sla_status_dia")
    .select(
      "status_dia_id, colaborador_id, filial_id, filial_nome, data_referencia, status_final, decidido_por, decidido_por_nome, entrou_pendente_em, decidido_em, minutos, faixa_sla"
    )
    .order("decidido_em", { ascending: false });

  if (inicioISO) query = query.gte("data_referencia", inicioISO);
  if (fimISO) query = query.lte("data_referencia", fimISO);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SlaStatusDia[];
}

export interface RankingSlaLider {
  lider_id: string;
  lider_nome: string;
  total_decisoes: number;
  tempo_medio_min: number;
  verdes: number;
  amarelos: number;
  vermelhos: number;
}

/** Agrupa as decisões por líder (client-side — o volume diário é pequeno o bastante para não precisar de outra view). */
export function ranquearPorLider(decisoes: SlaStatusDia[]): RankingSlaLider[] {
  const mapa = new Map<string, RankingSlaLider>();

  for (const d of decisoes) {
    if (!d.decidido_por) continue;
    const atual = mapa.get(d.decidido_por) ?? {
      lider_id: d.decidido_por,
      lider_nome: d.decidido_por_nome ?? "—",
      total_decisoes: 0,
      tempo_medio_min: 0,
      verdes: 0,
      amarelos: 0,
      vermelhos: 0,
    };
    const somaAnterior = atual.tempo_medio_min * atual.total_decisoes;
    atual.total_decisoes += 1;
    atual.tempo_medio_min = Math.round(((somaAnterior + d.minutos) / atual.total_decisoes) * 10) / 10;
    if (d.faixa_sla === "verde") atual.verdes += 1;
    else if (d.faixa_sla === "amarelo") atual.amarelos += 1;
    else atual.vermelhos += 1;
    mapa.set(d.decidido_por, atual);
  }

  return Array.from(mapa.values()).sort((a, b) => a.tempo_medio_min - b.tempo_medio_min);
}

/** Média de tempo de decisão por dia (para gráfico/tabela de evolução diária). */
export function mediaDiaria(decisoes: SlaStatusDia[]): { data: string; media_min: number; total: number }[] {
  const mapa = new Map<string, { soma: number; total: number }>();
  for (const d of decisoes) {
    const atual = mapa.get(d.data_referencia) ?? { soma: 0, total: 0 };
    atual.soma += d.minutos;
    atual.total += 1;
    mapa.set(d.data_referencia, atual);
  }
  return Array.from(mapa.entries())
    .map(([data, { soma, total }]) => ({ data, media_min: Math.round((soma / total) * 10) / 10, total }))
    .sort((a, b) => (a.data < b.data ? 1 : -1));
}

/** Média de tempo de decisão por mês ("YYYY-MM"). */
export function mediaMensal(decisoes: SlaStatusDia[]): { mes: string; media_min: number; total: number }[] {
  const mapa = new Map<string, { soma: number; total: number }>();
  for (const d of decisoes) {
    const mes = d.data_referencia.slice(0, 7);
    const atual = mapa.get(mes) ?? { soma: 0, total: 0 };
    atual.soma += d.minutos;
    atual.total += 1;
    mapa.set(mes, atual);
  }
  return Array.from(mapa.entries())
    .map(([mes, { soma, total }]) => ({ mes, media_min: Math.round((soma / total) * 10) / 10, total }))
    .sort((a, b) => (a.mes < b.mes ? 1 : -1));
}
