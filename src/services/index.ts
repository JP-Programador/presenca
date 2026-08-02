// Ponto único de importação dos services. Prefira importar direto do
// arquivo específico em código novo (@/services/presencaService, etc.) —
// este barrel existe para conveniência em consumidores externos e para
// deixar explícito, num só lugar, tudo que fala com o Supabase.

export * from "@/services/supabaseClient";
export * as authService from "@/services/authService";
export * as checkinService from "@/services/checkinService";
export * as presencaService from "@/services/presencaService";
export * as coordenacaoService from "@/services/coordenacaoService";
export * as exportService from "@/services/exportService";
export * as calendarioService from "@/services/calendarioService";
export * as statusDiaService from "@/services/statusDiaService";
