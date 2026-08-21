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
  { tipo: "atendimentos", label: "Atendimentos (chegada/saída)" },
];

/** Uma linha do histórico de chegada/saída de atendimento (visita a cliente). */
export interface LinhaRelatorioAtendimento {
  id: string;
  data_referencia: string;
  horario_registrado: string;
  tipo: "entrada" | "saida";
  colaborador_nome: string;
  colaborador_matricula: string;
  endereco_completo: string | null;
}
