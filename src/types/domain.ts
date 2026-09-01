// Tipos de domínio usados pelas telas — espelham o schema SQL (supabase/migrations).
// Serão substituídos/complementados pelos tipos gerados via `supabase gen types` em database.types.ts.

export type PerfilAcesso = "admin" | "gerente" | "auditor" | "coordenador" | "gestor" | "colaborador";

export type TipoContrato = "clt" | "aprendiz" | "estagiario" | "temporario" | "pj";

export type TipoMarcacao =
  | "entrada"
  | "inicio_intervalo"
  | "fim_intervalo"
  | "saida";

export type StatusPresenca =
  | "presente"
  | "atrasado"
  | "ausente"
  | "justificado"
  | "pendente_aprovacao";

export type StatusJustificativa = "pendente" | "aprovada" | "rejeitada";

/** Classificação de um dia no calendário operacional (Módulo 5). */
export type TipoDiaCalendario = "UTIL" | "SABADO" | "DOMINGO" | "FERIADO";

export interface CalendarioExcecao {
  data: string; // "YYYY-MM-DD"
  tipo: TipoDiaCalendario;
  descricao: string | null;
}

export interface Filial {
  id: string;
  codigo: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  ativo: boolean;
}

export interface Colaborador {
  id: string;
  filial_id: string;
  lider_id: string | null;
  matricula: string;
  nome: string;
  cargo: string | null;
  tipo_contrato: TipoContrato;
  ativo: boolean;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  localizacao_precisao: "exata" | "bairro" | "cidade" | "manual" | null;
  // campos "achatados" via join
  filial_nome?: string;
  lider_nome?: string;
}

export interface RegistroPresenca {
  id: string;
  colaborador_id: string;
  filial_id: string;
  tipo: TipoMarcacao;
  status: StatusPresenca;
  data_referencia: string;
  horario_previsto: string | null;
  horario_registrado: string;
  latitude: number | null;
  longitude: number | null;
  foto_path: string | null;
  observacao: string | null;
  created_at: string;
  analisado_por: string | null;
  analisado_em: string | null;
  // campos "achatados" via join, usados no dashboard do líder
  colaborador_nome?: string;
  colaborador_matricula?: string;
  filial_nome?: string;
}

export interface SlaLider {
  gestor_id: string;
  gestor_nome: string;
  filial_home_nome: string | null;
  total_decisoes: number;
  total_aprovadas: number;
  total_rejeitadas: number;
  tempo_medio_min: number | null;
  pct_dentro_sla: number | null;
  pendencias_atuais: number;
}

export interface AuditLogEntry {
  id: number;
  ator_id: string | null;
  ator_nome?: string;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  detalhes: Record<string, unknown> | null;
  created_at: string;
}

export interface UsuarioComHierarquia extends PerfilUsuario {
  filial_home_nome?: string | null;
  coordenador_nome?: string | null;
  ativo: boolean;
}

export interface Justificativa {
  id: string;
  registro_id: string | null;
  colaborador_id: string;
  data_referencia: string;
  motivo: string;
  anexo_path: string | null;
  status: StatusJustificativa;
  created_at: string;
  colaborador_nome?: string;
  filial_nome?: string;
}

export interface PerfilUsuario {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilAcesso;
  filial_id: string | null;
  coordenador_id?: string | null;
  senha_temporaria?: boolean;
  /** Só relevante quando perfil = 'gestor': exige também a saída de atendimento da equipe, não só a chegada. */
  exige_saida_atendimento?: boolean;
  /** Só relevante quando perfil = 'gestor': true = líder marca presença sempre manual, esconde mapa/check-ins perto de casa no painel dele. */
  dispensa_mapa?: boolean;
}
