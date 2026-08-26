// supabase/functions/enviar-notificacoes-push/index.ts
//
// Chamada pelo pg_cron (6 horários — ver migration 0066) pra mandar
// lembretes de "quem não lançou" via Web Push:
//   - líder: 08:00/08:30/09:00 (lembrete) e 09:15 (final, já em FALTA)
//   - coordenador: 08:30 (lembrete) e 09:15 (final)
// Nunca mexe em status_dia nem em "alertas" — é só notificação no navegador.
//
// Protegida por um segredo compartilhado (query param ?secret=) em vez de
// JWT, porque quem chama é o pg_cron via net.http_post — mesmo padrão de
// "verify_jwt = false" já usado em outras funções públicas do projeto,
// mas com esse segredo extra pra não virar endpoint aberto de disparo.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("PUSH_CRON_SECRET")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails("mailto:suporte@tlp.com.br", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== CRON_SECRET) {
    return json({ error: "não autorizado" }, 401);
  }

  const publico = url.searchParams.get("publico"); // "lider" | "coordenador"
  const fase = url.searchParams.get("fase"); // "lembrete" | "final"
  if (publico !== "lider" && publico !== "coordenador") return json({ error: "publico inválido" }, 400);
  if (fase !== "lembrete" && fase !== "final") return json({ error: "fase inválida" }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: "tlp_presenca" },
  });

  // Nunca notifica fim de semana/feriado — o cron só cobre seg-sex, mas
  // feriado cadastrado no meio da semana também tem que pular.
  const { data: tipoDia } = await supabase.rpc("tipo_dia_calendario", {
    p_data: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
  });
  if (tipoDia !== "UTIL") return json({ ok: true, ignorado: "dia não útil" });

  let enviados = 0;
  let expiradas = 0;

  async function notificarDestinatario(perfilId: string, titulo: string, corpo: string) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("perfil_id", perfilId);

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({ title: titulo, body: corpo })
        );
        enviados++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Inscrição expirada/inválida (usuário desinstalou, trocou de navegador etc.) — remove.
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          expiradas++;
        } else {
          console.error(`falha ao enviar push pra ${perfilId}:`, err);
        }
      }
    }
  }

  if (publico === "lider") {
    const { data: linhas, error } = await supabase.rpc("contar_nao_lancaram_por_lider");
    if (error) return json({ error: error.message }, 500);

    for (const linha of (linhas ?? []) as { lider_id: string; total: number }[]) {
      if (linha.total === 0) continue;
      const titulo = fase === "final" ? "Colaboradores em falta" : "Presenças pendentes";
      const corpo =
        fase === "final"
          ? `${linha.total} colaborador(es) estão com FALTA por não lançarem presença hoje.`
          : `${linha.total} colaborador(es) ainda não lançaram presença hoje.`;
      await notificarDestinatario(linha.lider_id, titulo, corpo);
    }
  } else {
    const { data: linhas, error } = await supabase.rpc("resumo_nao_lancaram_por_coordenador");
    if (error) return json({ error: error.message }, 500);

    for (const linha of (linhas ?? []) as {
      coordenador_id: string;
      lideres_pendentes: number;
      total_colaboradores: number;
      colaboradores_pendentes: number;
    }[]) {
      if (linha.lideres_pendentes === 0) continue;
      const percentual =
        linha.total_colaboradores > 0 ? Math.round((linha.colaboradores_pendentes / linha.total_colaboradores) * 100) : 0;
      const titulo = fase === "final" ? "Resumo de pendências" : "Líderes com pendência";
      const corpo = `${linha.lideres_pendentes} líder(es) com pendência — ${percentual}% da equipe ainda não lançou.`;
      await notificarDestinatario(linha.coordenador_id, titulo, corpo);
    }
  }

  return json({ ok: true, enviados, expiradas });
});
