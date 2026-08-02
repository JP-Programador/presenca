import type { TipoDiaCalendario } from "@/types/domain";

/** Status do dia por colaborador (Módulo 6) — distinto de StatusPresenca (marcação individual). */
export type StatusDia = "FALTA" | "FOLGA" | "PENDENTE" | "PRESENTE" | "ATESTADO" | "OUTROS";

export const STATUS_DIA_VALORES: StatusDia[] = [
  "FALTA",
  "FOLGA",
  "PENDENTE",
  "PRESENTE",
  "ATESTADO",
  "OUTROS",
];

/** Status que o líder pode aplicar manualmente (não fazem parte do fluxo automático). */
export const STATUS_DIA_MANUAIS: StatusDia[] = ["PRESENTE", "FALTA", "ATESTADO", "FOLGA", "OUTROS"];

export type MotivoOutros =
  | "Férias"
  | "Treinamento"
  | "Afastamento"
  | "Banco de horas"
  | "Plantão não escalado"
  | "Outro";

export const MOTIVOS_OUTROS: MotivoOutros[] = [
  "Férias",
  "Treinamento",
  "Afastamento",
  "Banco de horas",
  "Plantão não escalado",
  "Outro",
];

export interface StatusDiaRegistro {
  id: string;
  colaborador_id: string;
  filial_id: string;
  data_referencia: string;
  tipo_dia: TipoDiaCalendario;
  status: StatusDia;
  registro_presenca_id: string | null;
  motivo_outros: MotivoOutros | null;
  observacao: string | null;
  decidido_por: string | null;
  decidido_em: string | null;
  created_at: string;
  updated_at: string;
  // campos "achatados" via join, usados nos dashboards
  colaborador_nome?: string;
  colaborador_matricula?: string;
  filial_nome?: string;
  decidido_por_nome?: string;
  foto_path?: string | null;
}

export const STATUS_DIA_LABEL: Record<StatusDia, string> = {
  FALTA: "Falta",
  FOLGA: "Folga",
  PENDENTE: "Pendente",
  PRESENTE: "Presente",
  ATESTADO: "Atestado",
  OUTROS: "Outros",
};

/** Cor semântica de cada status, usada em badges/mapa (ver Módulo 9/14). */
export const STATUS_DIA_COR: Record<StatusDia, "verde" | "amarelo" | "vermelho" | "azul" | "cinza"> = {
  PRESENTE: "verde",
  PENDENTE: "amarelo",
  FALTA: "vermelho",
  ATESTADO: "azul",
  FOLGA: "cinza",
  OUTROS: "cinza",
};

/** Hex correspondente a STATUS_DIA_COR, usado nos marcadores do Leaflet (Módulo 9). */
export const STATUS_DIA_HEX: Record<StatusDia, string> = {
  PRESENTE: "#2E7D32",
  PENDENTE: "#F5B000",
  FALTA: "#C62828",
  ATESTADO: "#1E6FA8",
  FOLGA: "#9E9E9E",
  OUTROS: "#9E9E9E",
};

export type FaixaSla = "verde" | "amarelo" | "vermelho";

/** Uma decisão de status_dia já concluída, com tempo de resposta (Módulo 10). */
export interface SlaStatusDia {
  status_dia_id: string;
  colaborador_id: string;
  filial_id: string;
  filial_nome: string | null;
  data_referencia: string;
  status_final: StatusDia;
  decidido_por: string | null;
  decidido_por_nome: string | null;
  entrou_pendente_em: string;
  decidido_em: string;
  minutos: number;
  faixa_sla: FaixaSla;
}

/** Ponto do mapa operacional — status_dia + localização/precisão do registro vinculado, se houver. */
export interface PontoMapaOperacional {
  status_dia_id: string;
  colaborador_id: string;
  filial_id: string;
  data_referencia: string;
  status: StatusDia;
  colaborador_nome: string;
  colaborador_matricula: string;
  filial_nome: string;
  latitude: number | null;
  longitude: number | null;
  precisao_metros: number | null;
  horario_registrado: string | null;
}
