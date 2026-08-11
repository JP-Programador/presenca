import { supabase } from "@/services/supabaseClient";

export interface AlertaFerias {
  id: string;
  tipo: string;
  colaborador_id: string | null;
  detalhes: {
    data_inicio?: string;
    data_fim?: string;
    datas_conflito?: string[];
    aplicado_por?: string;
  };
  lido: boolean;
  created_at: string;
  colaborador_nome?: string;
}

const SELECT_COLUNAS = "id, tipo, colaborador_id, detalhes, lido, created_at, colaboradores(nome)";

interface AlertaRowBruta extends Omit<AlertaFerias, "colaborador_nome"> {
  colaboradores: { nome: string } | null;
}

/** Lista os alertas não lidos endereçados ao usuário logado (RLS já restringe a destinatario_id = auth.uid()). */
export async function listarAlertasNaoLidos(): Promise<AlertaFerias[]> {
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
