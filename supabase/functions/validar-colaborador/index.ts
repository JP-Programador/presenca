// supabase/functions/validar-colaborador/index.ts
//
// Endpoint público leve, chamado enquanto o técnico digita filial+matrícula
// na tela de presença — só confirma se existe um colaborador ativo com
// esses dados (sem foto/GPS/gravação), pra mostrar um aviso "fale com o
// líder" antes dele tentar capturar foto à toa. Também devolve, só de
// leitura, qual vai ser a próxima marcação (entrada/saída) e se a equipe
// dele exige saída de atendimento — pra tela já mostrar o botão certo
// ANTES de abrir a câmera, sem o técnico escolher nada.

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
  // Limite mais alto que os outros dois: chamada a cada dígito digitado
  // (debounced), e o IP costuma ser compartilhado por toda a filial
  // (Wi-Fi da empresa) — com muita gente validando matrícula ao mesmo
  // tempo, esse é o primeiro a esbarrar num limite baixo.
  if (!(await dentroDoLimite(supabase, "validar-colaborador", ip, 900, 300))) {
    return json({ encontrado: false }, 200);
  }

  const { data: filial } = await supabase.from("filiais").select("id, nome").eq("codigo", codigo_filial).maybeSingle();
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

  let liderNome: string | null = null;
  let exigeSaida = false;
  if (colaborador.lider_id) {
    const { data: lider } = await supabase
      .from("perfis")
      .select("nome, exige_saida_atendimento")
      .eq("id", colaborador.lider_id)
      .maybeSingle();
    liderNome = lider?.nome ?? null;
    exigeSaida = lider?.exige_saida_atendimento ?? false;
  }

  // Só leitura — mesma decisão (proximo_tipo_marcacao) que checkin-publico
  // revalida de verdade na hora de gravar; aqui é só preview pra UI.
  const { data: proximaMarcacao } = await supabase.rpc("proximo_tipo_marcacao", {
    p_colaborador_id: colaborador.id,
  });

  return json(
    {
      encontrado: true,
      nome: colaborador.nome,
      lider_nome: liderNome,
      equipe: filial.nome,
      exige_saida: exigeSaida,
      proxima_marcacao: (proximaMarcacao as string | null) ?? "entrada",
    },
    200
  );
});
