import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar definidas no .env"
  );
}

// O projeto Supabase é compartilhado com outros sistemas — todo o schema do
// TLP Presença vive isolado em "tlp_presenca" (nunca em "public"), para não
// colidir com tabelas/funções de outros projetos no mesmo banco. Isso exige
// que "tlp_presenca" esteja na lista de "Exposed schemas" em Project
// Settings → API no painel do Supabase (não fica exposto por padrão).
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  db: { schema: "tlp_presenca" },
});
