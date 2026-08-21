// supabase/functions/validar-atendimento/index.ts
//
// Endpoint público leve, chamado enquanto o técnico digita filial+matrícula
// na tela /atendimento — confirma o colaborador e já devolve o que a tela
// precisa saber pra decidir o botão certo ANTES de abrir a câmera: se a
// equipe dele exige saída, e se chegada/saída de hoje já foram registradas.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { dentroDoLimite, extrairIp } from "../_shared/rateLimit.ts";

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

  const ip = extrairIp(req);
  if (!(await dentroDoLimite(supabase, "validar-atendimento", ip, 900, 300))) {
    return json({ encontrado: false }, 200);
  }

  const { data: filial } = await supabase.from("filiais").select("id").eq("codigo", codigo_filial).maybeSingle();
  if (!filial) return json({ encontrado: false }, 200);

  const { data: candidatos } = await supabase
    .from("colaboradores")
    .select("id, nome, matricula, lider_id")
    .eq("filial_id", filial.id)
    .eq("ativo", true)
    .ilike("matricula", `%${matricula4}`);

  const encontrados = (candidatos ?? []).filter((c) => c.matricula.slice(-4) === matricula4);
  if (encontrados.length !== 1) return json({ encontrado: false }, 200);

  const colaborador = encontrados[0];

  let exigeSaida = false;
  if (colaborador.lider_id) {
    const { data: lider } = await supabase
      .from("perfis")
      .select("exige_saida_atendimento")
      .eq("id", colaborador.lider_id)
      .maybeSingle();
    exigeSaida = lider?.exige_saida_atendimento ?? false;
  }

  const hojeSp = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const { data: marcacoesHoje } = await supabase
    .from("marcacoes_atendimento")
    .select("tipo")
    .eq("colaborador_id", colaborador.id)
    .eq("data_referencia", hojeSp);

  const temEntradaHoje = (marcacoesHoje ?? []).some((m) => m.tipo === "entrada");
  const temSaidaHoje = (marcacoesHoje ?? []).some((m) => m.tipo === "saida");

  return json(
    {
      encontrado: true,
      nome: colaborador.nome,
      exige_saida: exigeSaida,
      tem_entrada_hoje: temEntradaHoje,
      tem_saida_hoje: temSaidaHoje,
    },
    200
  );
});
