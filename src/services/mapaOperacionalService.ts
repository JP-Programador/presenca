import { supabase } from "@/services/supabaseClient";
import type { PontoMapaOperacional } from "@/types/status";

/** Lista os pontos do mapa operacional (status_dia + localização, quando houver) numa data. */
export async function listarMapaOperacional(dataISO: string): Promise<PontoMapaOperacional[]> {
  const { data, error } = await supabase
    .from("vw_mapa_operacional")
    .select(
      "status_dia_id, colaborador_id, filial_id, data_referencia, status, colaborador_nome, colaborador_matricula, filial_nome, latitude, longitude, precisao_metros, horario_registrado"
    )
    .eq("data_referencia", dataISO);

  if (error) throw error;
  return (data ?? []) as PontoMapaOperacional[];
}

/** Mesmos pontos, mas de um colaborador específico ao longo de um período (base da "trilha" no dashboard de presença). */
export async function listarMapaOperacionalPeriodo(
  inicioISO: string,
  fimISO: string,
  colaboradorId: string
): Promise<PontoMapaOperacional[]> {
  const { data, error } = await supabase
    .from("vw_mapa_operacional")
    .select(
      "status_dia_id, colaborador_id, filial_id, data_referencia, status, colaborador_nome, colaborador_matricula, filial_nome, latitude, longitude, precisao_metros, horario_registrado"
    )
    .gte("data_referencia", inicioISO)
    .lte("data_referencia", fimISO)
    .eq("colaborador_id", colaboradorId);

  if (error) throw error;
  return (data ?? []) as PontoMapaOperacional[];
}

export interface LiderFilial {
  filial_id: string;
  filial_nome: string;
  lider_id: string;
  lider_nome: string;
}

/**
 * Mapeamento filial -> líder(es) responsáveis, usado no filtro "por líder" do
 * mapa. Derivado direto de quem lidera quem (colaboradores.lider_id) — não de
 * uma atribuição manual de filial (esse modelo antigo, via gestor_filiais,
 * dava a um líder visão de TODA a filial, não só da sua equipe direta).
 */
export async function listarLideresPorFilial(): Promise<LiderFilial[]> {
  const { data, error } = await supabase
    .from("colaboradores")
    .select("filial_id, filiais(nome), lider_id, lider:perfis!lider_id(nome)")
    .not("lider_id", "is", null);

  if (error) throw error;

  const vistos = new Set<string>();
  const linhas: LiderFilial[] = [];
  for (const row of (data ?? []) as any[]) {
    const chave = `${row.lider_id}:${row.filial_id}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    linhas.push({
      filial_id: row.filial_id,
      filial_nome: row.filiais?.nome ?? "",
      lider_id: row.lider_id,
      lider_nome: row.lider?.nome ?? "",
    });
  }
  return linhas;
}
