import { supabase } from "@/services/supabaseClient";

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
