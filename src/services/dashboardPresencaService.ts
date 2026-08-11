import { supabase } from "@/services/supabaseClient";
import type { RegistroPresenca } from "@/types/domain";

/** Horários (timestamptz ISO) de check-in de entrada num dia — RLS já escopa por hierarquia (líder só vê a própria equipe). */
export async function listarHorariosEntrada(dataISO: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("registros_presenca")
    .select("horario_registrado")
    .eq("tipo", "entrada")
    .eq("data_referencia", dataISO);

  if (error) throw error;
  return (data ?? []).map((r) => r.horario_registrado as string);
}

/** Registros de entrada marcados como atrasado num período — base do ranking de atrasos. */
export async function listarRegistrosAtrasados(inicioISO: string, fimISO: string): Promise<RegistroPresenca[]> {
  const { data, error } = await supabase
    .from("registros_presenca")
    .select(
      "id, colaborador_id, filial_id, tipo, status, data_referencia, horario_previsto, horario_registrado, colaboradores(nome), filiais(nome)"
    )
    .eq("tipo", "entrada")
    .eq("status", "atrasado")
    .gte("data_referencia", inicioISO)
    .lte("data_referencia", fimISO);

  if (error) throw error;

  type LinhaBruta = Omit<RegistroPresenca, "colaborador_nome" | "filial_nome" | "colaborador_matricula"> & {
    colaboradores: { nome: string } | null;
    filiais: { nome: string } | null;
  };

  return ((data ?? []) as unknown as LinhaBruta[]).map((row) => ({
    ...row,
    colaborador_nome: row.colaboradores?.nome,
    filial_nome: row.filiais?.nome,
  }));
}
