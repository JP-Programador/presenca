// Este arquivo deve ser substituído pelo output real de:
//   npx supabase gen types typescript --project-id <PROJECT_ID> --schema tlp_presenca > src/types/database.types.ts
//
// Nota: o schema é "tlp_presenca", não "public" — este banco é compartilhado
// com outros projetos, então todo o sistema TLP Presença vive isolado nesse
// schema próprio (ver supabase/migrations/0001_extensions_and_types.sql).
//
// Deixado como placeholder "aberto" (any nas linhas) só para o projeto compilar
// antes da geração real — depois de gerado, o Supabase client volta a tipar
// select/insert/update com precisão total.
type AnyRecord = Record<string, any>;

export type Database = {
  tlp_presenca: {
    Tables: Record<
      string,
      { Row: AnyRecord; Insert: AnyRecord; Update: AnyRecord; Relationships: [] }
    >;
    Views: Record<string, { Row: AnyRecord; Relationships: [] }>;
    Functions: Record<string, { Args: AnyRecord; Returns: any }>;
    Enums: Record<string, string>;
  };
};
