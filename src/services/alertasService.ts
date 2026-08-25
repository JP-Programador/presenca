import { supabase } from "@/services/supabaseClient";

export type TipoAlerta =
  | "ferias_sobrescreveu_registro"
  | "checkin_proximo_residencia"
  | "atendimento_pendente_fechamento"
  | "atendimento_sem_fechamento";

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
    // atendimento_pendente_fechamento / atendimento_sem_fechamento
    registro_presenca_id?: string;
    colaborador_matricula?: string;
    entrada_aprovada_em?: string;
    horas_decorridas?: number;
    latitude?: number;
    longitude?: number;
    endereco_completo?: string;
    status_saida?: "sem_saida" | "pendente" | "aprovado" | "rejeitado";
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

export interface CheckinPertoCasa {
  alerta_id: string;
  colaborador_nome: string;
  colaborador_matricula: string | null;
  distancia_km: number | null;
  tipo_marcacao: string | null;
  data_referencia: string | null;
  horario_registrado: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Histórico de check-ins feitos perto da residência cadastrada (RLS já
 * restringe pelo destinatário do alerta — líder/coordenador só vê o próprio
 * time). Junta com registros_presenca pra recuperar lat/lon (o alerta em si
 * só guarda a distância, não a coordenada).
 */
export async function listarCheckinsPertoCasa(diasAtras = 30): Promise<CheckinPertoCasa[]> {
  const desde = new Date();
  desde.setDate(desde.getDate() - diasAtras);

  const { data, error } = await supabase
    .from("alertas")
    .select("id, detalhes, colaboradores(nome, matricula)")
    .eq("tipo", "checkin_proximo_residencia")
    .gte("created_at", desde.toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;

  interface LinhaBruta {
    id: string;
    detalhes: Alerta["detalhes"];
    colaboradores: { nome: string; matricula: string } | null;
  }
  const linhas = (data ?? []) as unknown as LinhaBruta[];
  const idsRegistro = [...new Set(linhas.map((l) => l.detalhes.registro_presenca_id).filter(Boolean))] as string[];
  if (idsRegistro.length === 0) return [];

  const { data: registros } = await supabase
    .from("registros_presenca")
    .select("id, latitude, longitude, horario_registrado")
    .in("id", idsRegistro);
  const dadosPorId = new Map(
    (registros ?? []).map(
      (r: { id: string; latitude: number | null; longitude: number | null; horario_registrado: string }) => [
        r.id,
        { latitude: r.latitude, longitude: r.longitude, horario_registrado: r.horario_registrado },
      ]
    )
  );

  return linhas
    .filter((l) => l.detalhes.registro_presenca_id && dadosPorId.has(l.detalhes.registro_presenca_id))
    .map((l) => {
      const registro = dadosPorId.get(l.detalhes.registro_presenca_id!)!;
      return {
        alerta_id: l.id,
        colaborador_nome: l.colaboradores?.nome ?? "Colaborador",
        colaborador_matricula: l.colaboradores?.matricula ?? null,
        distancia_km: l.detalhes.distancia_km ?? null,
        tipo_marcacao: l.detalhes.tipo_marcacao ?? null,
        data_referencia: l.detalhes.data_referencia ?? null,
        horario_registrado: registro.horario_registrado,
        latitude: registro.latitude,
        longitude: registro.longitude,
      };
    });
}
