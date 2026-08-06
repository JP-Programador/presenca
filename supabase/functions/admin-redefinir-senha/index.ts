// supabase/functions/admin-redefinir-senha/index.ts
//
// Redefine a senha de um usuário existente direto para a senha inicial fixa
// (sem depender de e-mail — o projeto não tem SMTP configurado, então
// resetPasswordForEmail não chega no destinatário). Marca senha_temporaria
// = true de novo, obrigando a pessoa a trocar no próximo login.
//
// Quem pode chamar: só admin.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const SENHA_INICIAL = "Mudar@123";

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

interface Payload {
  usuario_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "sem_autenticacao" }, 401);

  const supabaseComoChamador = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    db: { schema: "tlp_presenca" },
  });

  const {
    data: { user },
  } = await supabaseComoChamador.auth.getUser();
  if (!user) return json({ error: "sessao_invalida" }, 401);

  const { data: perfilChamador } = await supabaseComoChamador
    .from("perfis")
    .select("perfil")
    .eq("id", user.id)
    .single();

  if (perfilChamador?.perfil !== "admin") {
    return json({ error: "sem_permissao", mensagem: "Apenas administrador pode redefinir senhas." }, 403);
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "payload_invalido" }, 400);
  }
  if (!payload.usuario_id) return json({ error: "campos_obrigatorios" }, 400);

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: "tlp_presenca" },
  });

  const { error: erroSenha } = await supabaseAdmin.auth.admin.updateUserById(payload.usuario_id, {
    password: SENHA_INICIAL,
  });
  if (erroSenha) return json({ error: "falha_redefinir_senha", mensagem: erroSenha.message }, 500);

  const { error: erroFlag } = await supabaseAdmin
    .from("perfis")
    .update({ senha_temporaria: true })
    .eq("id", payload.usuario_id);
  if (erroFlag) return json({ error: "falha_atualizar_perfil", mensagem: erroFlag.message }, 500);

  return json({ ok: true, senha_inicial: SENHA_INICIAL });
});
