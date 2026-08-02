// supabase/functions/validar-colaborador/index.ts
//
// Endpoint público leve, chamado enquanto o técnico digita filial+matrícula
// na tela de presença — só confirma se existe um colaborador ativo com
// esses dados (sem foto/GPS/gravação), pra mostrar um aviso "fale com o
// líder" antes dele tentar capturar foto à toa.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let payload: { codigo_filial?: string; matricula4?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "payload_invalido" }, 400);
  }

  const { codigo_filial, matricula4 } = payload;
  if (!codigo_filial || !matricula4 || matricula4.length !== 4) {
    return json({ encontrado: false }, 200);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: "tlp_presenca" },
  });

  const { data: filial } = await supabase.from("filiais").select("id").eq("codigo", codigo_filial).maybeSingle();
  if (!filial) return json({ encontrado: false }, 200);

  const { data: candidatos } = await supabase
    .from("colaboradores")
    .select("nome, matricula")
    .eq("filial_id", filial.id)
    .eq("ativo", true)
    .ilike("matricula", `%${matricula4}`);

  const encontrados = (candidatos ?? []).filter((c) => c.matricula.slice(-4) === matricula4);

  if (encontrados.length !== 1) return json({ encontrado: false }, 200);
  return json({ encontrado: true, nome: encontrados[0].nome }, 200);
});
