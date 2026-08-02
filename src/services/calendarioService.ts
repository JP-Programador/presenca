import { supabase } from "@/services/supabaseClient";
import { classificarDia, type TipoDia } from "@/lib/calendario";
import type { CalendarioExcecao, TipoDiaCalendario } from "@/types/domain";

/**
 * Carrega as exceções (feriados/ajustes manuais) de um intervalo de datas
 * e retorna um Map pronto para uso com `classificarDia`.
 */
export async function carregarExcecoes(
  inicioISO: string,
  fimISO: string
): Promise<Map<string, TipoDia>> {
  const { data, error } = await supabase
    .from("calendario")
    .select("data, tipo, descricao")
    .gte("data", inicioISO)
    .lte("data", fimISO);

  if (error) throw error;

  const mapa = new Map<string, TipoDia>();
  for (const row of data ?? []) {
    mapa.set(row.data as string, row.tipo as TipoDia);
  }
  return mapa;
}

/** Classifica uma única data, buscando apenas o dia em questão no banco. */
export async function obterTipoDia(dataISO: string): Promise<TipoDia> {
  const excecoes = await carregarExcecoes(dataISO, dataISO);
  return classificarDia(dataISO, excecoes);
}

export async function listarExcecoes(
  inicioISO: string,
  fimISO: string
): Promise<CalendarioExcecao[]> {
  const { data, error } = await supabase
    .from("calendario")
    .select("data, tipo, descricao")
    .gte("data", inicioISO)
    .lte("data", fimISO)
    .order("data", { ascending: true });

  if (error) throw error;

  return (data ?? []) as CalendarioExcecao[];
}

/** Cria ou atualiza um feriado/exceção manual (somente admin — reforçado por RLS). */
export async function salvarExcecao(
  dataISO: string,
  tipo: TipoDiaCalendario,
  descricao?: string
): Promise<void> {
  const { error } = await supabase
    .from("calendario")
    .upsert({ data: dataISO, tipo, descricao: descricao ?? null }, { onConflict: "data" });
  if (error) throw error;
}

export async function removerExcecao(dataISO: string): Promise<void> {
  const { error } = await supabase.from("calendario").delete().eq("data", dataISO);
  if (error) throw error;
}
