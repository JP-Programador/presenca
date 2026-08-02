import { supabase } from "@/services/supabaseClient";
import type { RegistroPresenca, Justificativa } from "@/types/domain";

/** Registros de presença aguardando decisão do líder (status = pendente_aprovacao). */
export async function listarRegistrosPendentes(): Promise<RegistroPresenca[]> {
  const { data, error } = await supabase
    .from("registros_presenca")
    .select(
      "id, colaborador_id, filial_id, tipo, status, data_referencia, horario_previsto, horario_registrado, latitude, longitude, foto_path, observacao, created_at, analisado_por, analisado_em, colaboradores(nome, matricula), filiais(nome)"
    )
    .eq("status", "pendente_aprovacao")
    .order("data_referencia", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    colaborador_nome: row.colaboradores?.nome,
    colaborador_matricula: row.colaboradores?.matricula,
    filial_nome: row.filiais?.nome,
  }));
}

/** Justificativas de ausência/atraso aguardando aprovação. */
export async function listarJustificativasPendentes(): Promise<Justificativa[]> {
  const { data, error } = await supabase
    .from("justificativas")
    .select(
      "id, registro_id, colaborador_id, data_referencia, motivo, anexo_path, status, created_at, colaboradores!inner(nome, filial_id, filiais(nome))"
    )
    .eq("status", "pendente")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    colaborador_nome: row.colaboradores?.nome,
    filial_nome: row.colaboradores?.filiais?.nome,
  }));
}

async function idUsuarioAtual(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function aprovarRegistro(id: string) {
  const analisado_por = await idUsuarioAtual();
  const { error } = await supabase
    .from("registros_presenca")
    .update({ status: "justificado", analisado_por, analisado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function rejeitarRegistro(id: string) {
  const analisado_por = await idUsuarioAtual();
  const { error } = await supabase
    .from("registros_presenca")
    .update({ status: "ausente", analisado_por, analisado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function aprovarJustificativa(id: string, registroId: string | null) {
  const analisado_por = await idUsuarioAtual();
  const agora = new Date().toISOString();
  const { error } = await supabase
    .from("justificativas")
    .update({ status: "aprovada", analisado_em: agora, analisado_por })
    .eq("id", id);
  if (error) throw error;

  if (registroId) {
    await supabase
      .from("registros_presenca")
      .update({ status: "justificado", analisado_por, analisado_em: agora })
      .eq("id", registroId);
  }
}

export async function rejeitarJustificativa(id: string, registroId: string | null) {
  const analisado_por = await idUsuarioAtual();
  const agora = new Date().toISOString();
  const { error } = await supabase
    .from("justificativas")
    .update({ status: "rejeitada", analisado_em: agora, analisado_por })
    .eq("id", id);
  if (error) throw error;

  if (registroId) {
    await supabase
      .from("registros_presenca")
      .update({ status: "ausente", analisado_por, analisado_em: agora })
      .eq("id", registroId);
  }
}

/** URL assinada temporária para visualizar a foto de um registro (bucket privado). */
export async function obterUrlFoto(fotoPath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("tlp-fotos-presenca")
    .createSignedUrl(fotoPath, 60 * 5); // 5 minutos
  if (error) return null;
  return data.signedUrl;
}
