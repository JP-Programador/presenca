import type { StatusDia } from "@/types/status";

/** Uma linha de relatório de presença (Módulo 12) — espelha tlp_presenca.vw_relatorio_presenca. */
export interface LinhaRelatorioPresenca {
  status_dia_id: string;
  data_referencia: string;
  colaborador_matricula: string;
  colaborador_nome: string;
  filial_id: string;
  filial_nome: string;
  lider_nome: string | null;
  status_final: StatusDia;
  hora_envio: string | null;
  hora_aprovacao: string | null;
  aprovado_por: string | null;
  motivo: string | null;
  observacao: string | null;
  latitude: number | null;
  longitude: number | null;
}

export type TipoRelatorio =
  | "diario"
  | "mensal"
  | "por_lider"
  | "por_filial"
  | "por_coordenador"
  | "pendencias"
  | "rejeicoes"
  | "auditoria"
  | "atendimentos";

export const TIPOS_RELATORIO: { tipo: TipoRelatorio; label: string }[] = [
  { tipo: "diario", label: "Presença diária" },
  { tipo: "mensal", label: "Presença mensal" },
  { tipo: "por_lider", label: "Por líder" },
  { tipo: "por_filial", label: "Por filial" },
  { tipo: "por_coordenador", label: "Por coordenador" },
  { tipo: "pendencias", label: "Pendências" },
  { tipo: "rejeicoes", label: "Rejeições" },
  { tipo: "auditoria", label: "Auditoria" },
  { tipo: "atendimentos", label: "Relatório de marcações" },
];

/** Uma linha do histórico de atendimento — entrada (presença) + saída (quando houver/for exigida), já emparelhadas. */
export interface LinhaRelatorioAtendimento {
  registro_presenca_id: string;
  colaborador_nome: string;
  colaborador_matricula: string;
  lider_nome: string | null;
  data_entrada: string;
  hora_entrada: string;
  endereco_entrada: string | null;
  data_saida: string | null;
  hora_saida: string | null;
  endereco_saida: string | null;
  tempo_total_min: number | null;
  status: "aberto" | "pendente_aprovacao_saida" | "fechado" | "saida_rejeitada";
  alertas_gerados: number;
}

/** Colaborador com mais de N dias de FALTA num período — só auditoria/admin (RPC já restringe). */
export interface FaltaRecorrente {
  colaborador_id: string;
  colaborador_nome: string;
  colaborador_matricula: string;
  filial_nome: string;
  lider_id: string | null;
  lider_nome: string | null;
  coordenador_id: string | null;
  coordenador_nome: string | null;
  total_faltas: number;
  primeira_falta: string;
  ultima_falta: string;
}
