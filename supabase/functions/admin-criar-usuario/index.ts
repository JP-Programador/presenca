// supabase/functions/admin-criar-usuario/index.ts
//
// Cria um novo usuário de login (auth.users) + a linha correspondente em
// tlp_presenca.perfis. Só pode ser chamada por um usuário autenticado cujo perfil
// seja 'admin' — gestão de usuários/hierarquia é exclusiva do admin (o
// coordenador tem leitura global, mas não gerencia pessoas; o auditor só lê).
//
// verify_jwt fica true (padrão) no config.toml: o Supabase já garante que
// só chega aqui uma requisição com um JWT válido; a checagem de PAPEL
// (admin/coordenador) é feita manualmente abaixo.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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
  perfil: "admin" | "auditor" | "coordenador" | "gestor" | "colaborador";
  filial_id?: string | null;
  filiais_gerenciadas?: string[]; // usado quando perfil = 'gestor'
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

  if (!perfilChamador || perfilChamador.perfil !== "admin") {
    return json({ error: "sem_permissao", mensagem: "Apenas o administrador pode criar usuários." }, 403);
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

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: "tlp_presenca" },
  });

  // 1. Cria o usuário e dispara e-mail de convite (define a própria senha)
  const { data: novoUsuario, error: erroCriacao } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    payload.email,
    { data: { nome: payload.nome } }
  );

  if (erroCriacao || !novoUsuario.user) {
    return json({ error: "falha_criar_usuario", mensagem: erroCriacao?.message }, 500);
  }

  // 2. Atualiza o perfil criado automaticamente pelo trigger handle_new_user
  //    (migration 0004) com o papel e a filial corretos.
  const { error: erroPerfil } = await supabaseAdmin
    .from("perfis")
    .update({ perfil: payload.perfil, filial_id: payload.filial_id ?? null })
    .eq("id", novoUsuario.user.id);

  if (erroPerfil) {
    return json({ error: "falha_atualizar_perfil", mensagem: erroPerfil.message }, 500);
  }

  // 3. Se for gestor, associa as filiais que ele vai gerenciar
  if (payload.perfil === "gestor" && payload.filiais_gerenciadas?.length) {
    const linhas = payload.filiais_gerenciadas.map((filial_id) => ({
      gestor_id: novoUsuario.user!.id,
      filial_id,
    }));
    const { error: erroGestorFiliais } = await supabaseAdmin.from("gestor_filiais").insert(linhas);
    if (erroGestorFiliais) {
      return json({ error: "falha_associar_filiais", mensagem: erroGestorFiliais.message }, 500);
    }
  }

  return json({ ok: true, usuario_id: novoUsuario.user.id });
});
