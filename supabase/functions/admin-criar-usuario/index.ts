// supabase/functions/admin-criar-usuario/index.ts
//
// Cria um novo usuário de login (auth.users) + a linha correspondente em
// tlp_presenca.perfis. Sem convite por e-mail (o projeto não tem SMTP
// configurado — e-mails de convite/redefinição não chegam): o usuário nasce
// com a senha inicial fixa abaixo e a flag senha_temporaria=true, que obriga
// a troca no primeiro acesso (ver TrocarSenhaObrigatoria.tsx no frontend).
//
// Quem pode chamar: admin cria qualquer papel; coordenador só pode criar
// 'gestor' (líder), e nesse caso o coordenador_id do novo líder é sempre o
// próprio coordenador chamador (ignora qualquer valor enviado no payload).
//
// verify_jwt fica true (padrão) no config.toml: o Supabase já garante que
// só chega aqui uma requisição com um JWT válido; a checagem de PAPEL é
// feita manualmente abaixo.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

/** Senha inicial fixa — sem envio de e-mail, quem cria repassa por fora (WhatsApp, verbal etc.). */
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

interface CriarUsuarioPayload {
  nome: string;
  email: string;
  perfil: "admin" | "gerente" | "auditor" | "coordenador" | "gestor" | "colaborador";
  filial_id?: string | null;
  coordenador_id?: string | null; // usado quando perfil = 'gestor' e quem cria é admin/gerente
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "sem_autenticacao" }, 401);

  // Cliente "como o usuário chamador", só para checar o papel dele.
  // db.schema: nosso schema isolado ("tlp_presenca") num banco compartilhado
  // com outros projetos — precisa ser explícito em todo createClient daqui.
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

  const ehAdmin = perfilChamador?.perfil === "admin";
  const ehGerente = perfilChamador?.perfil === "gerente";
  const ehCoordenador = perfilChamador?.perfil === "coordenador";

  if (!ehAdmin && !ehGerente && !ehCoordenador) {
    return json(
      { error: "sem_permissao", mensagem: "Apenas administrador, gerente ou coordenador podem criar usuários." },
      403
    );
  }

  let payload: CriarUsuarioPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "payload_invalido" }, 400);
  }

  if (!payload.nome || !payload.email || !payload.perfil) {
    return json({ error: "campos_obrigatorios" }, 400);
  }

  // Coordenador só pode criar líderes (gestor) — vira o coordenador direto
  // do novo líder automaticamente, ignorando qualquer valor enviado.
  if (ehCoordenador && payload.perfil !== "gestor") {
    return json(
      { error: "sem_permissao", mensagem: "Coordenador só pode criar líderes (gestor)." },
      403
    );
  }
  const coordenadorId = ehCoordenador ? user.id : payload.coordenador_id ?? null;

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: "tlp_presenca" },
  });

  // 1. Cria o usuário já com a senha inicial fixa (sem e-mail de convite) — o
  // próprio usuário troca no primeiro acesso (senha_temporaria, ver passo 2).
  const { data: novoUsuario, error: erroCriacao } = await supabaseAdmin.auth.admin.createUser({
    email: payload.email,
    password: SENHA_INICIAL,
    email_confirm: true,
    user_metadata: { nome: payload.nome },
  });

  if (erroCriacao || !novoUsuario.user) {
    return json({ error: "falha_criar_usuario", mensagem: erroCriacao?.message }, 500);
  }

  // 2. Atualiza o perfil criado automaticamente pelo trigger handle_new_user
  //    (migration 0004) com o papel, filial e hierarquia corretos.
  const { error: erroPerfil } = await supabaseAdmin
    .from("perfis")
    .update({
      perfil: payload.perfil,
      filial_id: payload.filial_id ?? null,
      coordenador_id: payload.perfil === "gestor" ? coordenadorId : null,
      senha_temporaria: true,
    })
    .eq("id", novoUsuario.user.id);

  if (erroPerfil) {
    return json({ error: "falha_atualizar_perfil", mensagem: erroPerfil.message }, 500);
  }

  return json({ ok: true, usuario_id: novoUsuario.user.id, senha_inicial: SENHA_INICIAL });
});
