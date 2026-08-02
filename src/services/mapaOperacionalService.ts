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

export interface LiderFilial {
  filial_id: string;
  filial_nome: string;
  lider_id: string;
  lider_nome: string;
}

/** Mapeamento filial -> líder(es) responsáveis, usado no filtro "por líder" do mapa. */
export async function listarLideresPorFilial(): Promise<LiderFilial[]> {
  const { data, error } = await supabase
    .from("gestor_filiais")
    .select("filial_id, filiais(nome), gestor_id, perfis(nome)");

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    filial_id: row.filial_id,
    filial_nome: row.filiais?.nome ?? "",
    lider_id: row.gestor_id,
    lider_nome: row.perfis?.nome ?? "",
  }));
}
