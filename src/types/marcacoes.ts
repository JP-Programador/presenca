// Módulo 13 — tipos para o futuro fluxo de 4 marcações diárias.
// Ainda SEM tela própria: só preparação de banco/tipos/services, para a
// tela do técnico evoluir de "1 marcação por chamada" (registros_presenca.tipo)
// para um dia completo com 4 marcações, sem quebrar o fluxo atual.

export type TipoMarcacaoDia = "ENTRADA" | "ALMOCO_SAIDA" | "ALMOCO_RETORNO" | "FINALIZACAO";

export const TIPOS_MARCACAO_DIA: TipoMarcacaoDia[] = [
  "ENTRADA",
  "ALMOCO_SAIDA",
  "ALMOCO_RETORNO",
  "FINALIZACAO",
];

export const TIPO_MARCACAO_DIA_LABEL: Record<TipoMarcacaoDia, string> = {
  ENTRADA: "Entrada",
  ALMOCO_SAIDA: "Saída para almoço",
  ALMOCO_RETORNO: "Retorno do almoço",
  FINALIZACAO: "Finalização do dia",
};

export interface MarcacaoDia {
  id: string;
  colaborador_id: string;
  filial_id: string;
  data_referencia: string;
  tipo: TipoMarcacaoDia;
  horario_registrado: string;
  latitude: number | null;
  longitude: number | null;
  precisao_metros: number | null;
  foto_path: string | null;
  observacao: string | null;
  created_at: string;
}
