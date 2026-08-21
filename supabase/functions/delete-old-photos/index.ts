// supabase/functions/delete-old-photos/index.ts
//
// Edge Function chamada pelo pg_cron (a cada 30 min, ver migration 0007).
// Localiza registros com foto(s) e foto_expira_em já vencido (horario
// registrado + 24h), apaga o(s) arquivo(s) do bucket 'tlp-fotos-presenca'
// e limpa a referência no banco, gravando auditoria. Cobre dois destinos:
// registros_presenca (foto de rosto + foto do carro/placa, quando houver)
// e marcacoes_atendimento (chegada/saída de atendimento).
//
// Usa a service_role key: roda com privilégios de servidor, ignorando RLS,
// pois é o único fluxo autorizado a apagar fotos em massa.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "tlp-fotos-presenca";
const BATCH_SIZE = 200; // evita varrer tabelas grandes de uma vez só

type RegistroPresencaComFoto = {
  id: string;
  foto_path: string | null;
  foto_carro_path: string | null;
};

type MarcacaoAtendimentoComFoto = {
  id: string;
  foto_path: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function limparRegistrosPresenca(supabase: any): Promise<number> {
  const { data: registros, error: selectError } = (await supabase
    .from("registros_presenca")
    .select("id, foto_path, foto_carro_path")
    .or("foto_path.not.is.null,foto_carro_path.not.is.null")
    .lte("foto_expira_em", new Date().toISOString())
    .limit(BATCH_SIZE)) as { data: RegistroPresencaComFoto[] | null; error: unknown };

  if (selectError) throw selectError;
  if (!registros || registros.length === 0) return 0;

  const paths = registros.flatMap((r) => [r.foto_path, r.foto_carro_path].filter((p): p is string => !!p));
  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
    if (removeError) throw removeError;
  }

  const ids = registros.map((r) => r.id);
  const { error: updateError } = await supabase
    .from("registros_presenca")
    .update({ foto_path: null, foto_carro_path: null, foto_expira_em: null })
    .in("id", ids);
  if (updateError) throw updateError;

  const auditRows = registros.map((r) => ({
    acao: "foto_excluida_48h",
    entidade: "registros_presenca",
    entidade_id: r.id,
    detalhes: { foto_path: r.foto_path, foto_carro_path: r.foto_carro_path },
  }));
  const { error: auditError } = await supabase.from("audit_log").insert(auditRows);
  if (auditError) console.error("Falha ao gravar audit_log (registros_presenca):", auditError);

  return registros.length;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function limparMarcacoesAtendimento(supabase: any): Promise<number> {
  const { data: marcacoes, error: selectError } = (await supabase
    .from("marcacoes_atendimento")
    .select("id, foto_path")
    .not("foto_path", "is", null)
    .lte("foto_expira_em", new Date().toISOString())
    .limit(BATCH_SIZE)) as { data: MarcacaoAtendimentoComFoto[] | null; error: unknown };

  if (selectError) throw selectError;
  if (!marcacoes || marcacoes.length === 0) return 0;

  const paths = marcacoes.map((m) => m.foto_path);
  const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
  if (removeError) throw removeError;

  const ids = marcacoes.map((m) => m.id);
  const { error: updateError } = await supabase
    .from("marcacoes_atendimento")
    .update({ foto_path: null, foto_expira_em: null })
    .in("id", ids);
  if (updateError) throw updateError;

  const auditRows = marcacoes.map((m) => ({
    acao: "foto_excluida_48h",
    entidade: "marcacoes_atendimento",
    entidade_id: m.id,
    detalhes: { foto_path: m.foto_path },
  }));
  const { error: auditError } = await supabase.from("audit_log").insert(auditRows);
  if (auditError) console.error("Falha ao gravar audit_log (marcacoes_atendimento):", auditError);

  return marcacoes.length;
}

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
    const apagadosPresenca = await limparRegistrosPresenca(supabase);
    const apagadosAtendimento = await limparMarcacoesAtendimento(supabase);

    return new Response(
      JSON.stringify({ ok: true, apagados: apagadosPresenca + apagadosAtendimento, apagadosPresenca, apagadosAtendimento }),
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
