// supabase/functions/delete-old-photos/index.ts
//
// Edge Function chamada pelo pg_cron (a cada 30 min, ver migration 0007).
// Localiza registros_presenca com foto_path preenchido e foto_expira_em
// já vencido (horario_registrado + 48h), apaga o arquivo do bucket
// 'tlp-fotos-presenca' e limpa a referência no banco, gravando auditoria.
//
// Usa a service_role key: roda com privilégios de servidor, ignorando RLS,
// pois é o único fluxo autorizado a apagar fotos em massa.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "tlp-fotos-presenca";
const BATCH_SIZE = 200; // evita varrer tabelas grandes de uma vez só

type RegistroComFoto = {
  id: string;
  foto_path: string;
};

Deno.serve(async (req: Request) => {
  // Só aceita chamadas do próprio pg_cron/serviço (Authorization com service key).
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.includes(SERVICE_ROLE_KEY)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: "tlp_presenca" },
  });

  try {
    // 1. Busca registros cuja foto já expirou (foto_expira_em <= agora)
    const { data: registros, error: selectError } = await supabase
      .from("registros_presenca")
      .select("id, foto_path")
      .not("foto_path", "is", null)
      .lte("foto_expira_em", new Date().toISOString())
      .limit(BATCH_SIZE) as { data: RegistroComFoto[] | null; error: unknown };

    if (selectError) {
      throw selectError;
    }

    if (!registros || registros.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, apagados: 0, mensagem: "Nada para apagar." }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const paths = registros.map((r) => r.foto_path);

    // 2. Remove os arquivos do bucket em lote
    const { error: removeError } = await supabase.storage
      .from(BUCKET)
      .remove(paths);

    if (removeError) {
      throw removeError;
    }

    // 3. Limpa as referências no banco (mantém o registro de presença, só remove a foto)
    const ids = registros.map((r) => r.id);
    const { error: updateError } = await supabase
      .from("registros_presenca")
      .update({ foto_path: null, foto_expira_em: null })
      .in("id", ids);

    if (updateError) {
      throw updateError;
    }

    // 4. Auditoria
    const auditRows = registros.map((r) => ({
      acao: "foto_excluida_48h",
      entidade: "registros_presenca",
      entidade_id: r.id,
      detalhes: { foto_path: r.foto_path },
    }));

    const { error: auditError } = await supabase.from("audit_log").insert(auditRows);
    if (auditError) {
      // Não falha a função por causa da auditoria — só loga.
      console.error("Falha ao gravar audit_log:", auditError);
    }

    return new Response(
      JSON.stringify({ ok: true, apagados: registros.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro em delete-old-photos:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
