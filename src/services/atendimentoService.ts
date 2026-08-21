import { supabase } from "@/services/supabaseClient";

export interface AtendimentoPendente {
  id: string;
  colaborador_id: string;
  data_referencia: string;
  horario_registrado: string;
  latitude: number;
  longitude: number;
  endereco_completo: string | null;
  status_aprovacao: "pendente" | "aprovado" | "rejeitado";
  colaborador_nome?: string;
  colaborador_matricula?: string;
  entrada_horario_registrado?: string;
}

const SELECT_COLUNAS =
  "id, colaborador_id, data_referencia, horario_registrado, latitude, longitude, endereco_completo, status_aprovacao, colaboradores(nome, matricula), registros_presenca!registro_presenca_entrada_id(horario_registrado)";

interface AtendimentoRowBruta
  extends Omit<AtendimentoPendente, "colaborador_nome" | "colaborador_matricula" | "entrada_horario_registrado"> {
  colaboradores: { nome: string; matricula: string } | null;
  registros_presenca: { horario_registrado: string } | null;
}

function mapearLinha(row: AtendimentoRowBruta): AtendimentoPendente {
  return {
    ...row,
    colaborador_nome: row.colaboradores?.nome,
    colaborador_matricula: row.colaboradores?.matricula,
    entrada_horario_registrado: row.registros_presenca?.horario_registrado,
  };
}

/** Saídas de atendimento aguardando aprovação, visíveis pelo usuário atual (mesma RLS de status_dia/registros_presenca). */
export async function listarAtendimentosPendentes(): Promise<AtendimentoPendente[]> {
  const { data, error } = await supabase
    .from("marcacoes_atendimento")
    .select(SELECT_COLUNAS)
    .eq("status_aprovacao", "pendente")
    .order("horario_registrado", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as AtendimentoRowBruta[]).map(mapearLinha);
}

/** Aprova/rejeita a saída — nunca mexe em status_dia (a presença do dia já foi decidida na aprovação da entrada). */
async function decidirSaida(id: string, aprovar: boolean): Promise<void> {
  const { error } = await supabase.rpc("aprovar_saida_atendimento", { p_marcacao_id: id, p_aprovar: aprovar });
  if (error) throw error;
}

export const aprovarSaida = (id: string) => decidirSaida(id, true);
export const rejeitarSaida = (id: string) => decidirSaida(id, false);
