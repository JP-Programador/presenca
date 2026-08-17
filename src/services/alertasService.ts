import { supabase } from "@/services/supabaseClient";

export type TipoAlerta = "ferias_sobrescreveu_registro" | "checkin_proximo_residencia";

export interface Alerta {
  id: string;
  tipo: TipoAlerta;
  colaborador_id: string | null;
  detalhes: {
    // ferias_sobrescreveu_registro
    data_inicio?: string;
    data_fim?: string;
    datas_conflito?: string[];
    aplicado_por?: string;
    // checkin_proximo_residencia
    distancia_km?: number;
    tipo_marcacao?: string;
    data_referencia?: string;
  };
  lido: boolean;
  created_at: string;
  colaborador_nome?: string;
}

const SELECT_COLUNAS = "id, tipo, colaborador_id, detalhes, lido, created_at, colaboradores(nome)";

interface AlertaRowBruta extends Omit<Alerta, "colaborador_nome"> {
  colaboradores: { nome: string } | null;
}

/** Lista os alertas não lidos endereçados ao usuário logado (RLS já restringe a destinatario_id = auth.uid()). */
export async function listarAlertasNaoLidos(): Promise<Alerta[]> {
  const { data, error } = await supabase
    .from("alertas")
    .select(SELECT_COLUNAS)
    .eq("lido", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as AlertaRowBruta[]).map((row) => ({
    ...row,
    colaborador_nome: row.colaboradores?.nome,
  }));
}

export async function marcarAlertaComoLido(id: string): Promise<void> {
  const { error } = await supabase.from("alertas").update({ lido: true }).eq("id", id);
  if (error) throw error;
}
