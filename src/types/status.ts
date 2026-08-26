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
  | "Frota"
  | "Exame periódico"
  | "Bloqueado IHS"
  | "Base"
  | "Outro";

export const MOTIVOS_OUTROS: MotivoOutros[] = [
  "Férias",
  "Treinamento",
  "Afastamento",
  "Banco de horas",
  "Plantão não escalado",
  "Frota",
  "Exame periódico",
  "Bloqueado IHS",
  "Base",
  "Outro",
];

/** Sigla de 2 letras por motivo — usada só na tabela resumo mensal (grade), pra bater o olho rápido. */
export const SIGLA_MOTIVO: Record<MotivoOutros, string> = {
  Férias: "FE",
  Afastamento: "AF",
  Frota: "FT",
  "Exame periódico": "EX",
  "Bloqueado IHS": "BQ",
  Base: "BA",
  "Banco de horas": "BH",
  "Plantão não escalado": "PL",
  Treinamento: "TR",
  Outro: "OT",
};

/** Cor por motivo — mesma tabela resumo mensal, uma cor distinta por linha. */
export const COR_MOTIVO: Record<MotivoOutros, string> = {
  Férias: "bg-[#FFF9DB] text-[#8A6D00]",
  Afastamento: "bg-[#F1E7FB] text-[#6A3FA0]",
  Frota: "bg-[#E7F3E8] text-[#2E7D32]",
  "Exame periódico": "bg-[#E3EEFA] text-[#1E6FA8]",
  "Bloqueado IHS": "bg-[#F6D9D9] text-[#8A1F1F]",
  Base: "bg-[#E4ECF1] text-[#3B5A6B]",
  "Banco de horas": "bg-[#E5E4FA] text-[#4B4699]",
  "Plantão não escalado": "bg-[#FDE8D6] text-[#A85E1B]",
  Treinamento: "bg-[#D9F3F3] text-[#1B7A7A]",
  Outro: "bg-surface text-ink/60 dark:bg-white/10 dark:text-white/60",
};

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
  lider_nome?: string | null;
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
  endereco_completo: string | null;
}
