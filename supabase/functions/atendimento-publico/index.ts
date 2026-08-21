// supabase/functions/atendimento-publico/index.ts
//
// Endpoint público (sem login) chamado pela tela /atendimento — chegada e,
// se o líder exigir, saída de uma visita a cliente. Independente da
// presença diária (registros_presenca/status_dia): nunca afeta Falta/
// Presente. Mesma identificação (filial + 4 últimos da matrícula), mesma
// foto+GPS obrigatórios do check-in de presença — só o destino é outro
// (tabela marcacoes_atendimento) e o servidor decide sozinho se é entrada
// ou saída, sem o técnico escolher.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { dentroDoLimite, extrairIp } from "../_shared/rateLimit.ts";
import { geocodificarReverso } from "../_shared/geoReverso.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "tlp-fotos-presenca";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AtendimentoPayload {
  codigo_filial: string;
  matricula4: string;
  foto_base64: string;
  latitude: number;
  longitude: number;
  precisao?: number;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let payload: AtendimentoPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "payload_invalido" }, 400);
  }

  const { codigo_filial, matricula4, foto_base64, latitude, longitude, precisao } = payload;

  if (!codigo_filial || !matricula4 || matricula4.length !== 4 || !foto_base64 || latitude == null || longitude == null) {
    return json(
      {
        error: "campos_obrigatorios",
        mensagem: "Código da filial, 4 últimos dígitos da matrícula, foto e GPS são obrigatórios.",
      },
      400
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: "tlp_presenca" },
  });

  const ip = extrairIp(req);
  if (!(await dentroDoLimite(supabase, "atendimento-publico", ip, 300, 300))) {
    return json(
      { error: "muitas_tentativas", mensagem: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
      429
    );
  }

  // 1. Localiza a filial
  const { data: filial, error: filialError } = await supabase
    .from("filiais")
    .select("id")
    .eq("codigo", codigo_filial)
    .maybeSingle();

  if (filialError) return json({ error: "erro_consulta", mensagem: filialError.message }, 500);
  if (!filial) return json({ error: "filial_nao_encontrada", mensagem: "Código da filial não encontrado." }, 404);

  // 2. Localiza o colaborador e o líder dele (pra saber se exige saída)
  const { data: candidatos, error: colaboradorError } = await supabase
    .from("colaboradores")
    .select("id, filial_id, nome, ativo, matricula, lider_id")
    .eq("filial_id", filial.id)
    .eq("ativo", true)
    .ilike("matricula", `%${matricula4}`);

  if (colaboradorError) return json({ error: "erro_consulta", mensagem: colaboradorError.message }, 500);

  const encontrados = (candidatos ?? []).filter((c) => c.matricula.slice(-4) === matricula4);
  if (encontrados.length === 0) {
    return json({ error: "colaborador_nao_encontrado", mensagem: "Filial ou matrícula não conferem." }, 404);
  }
  if (encontrados.length > 1) {
    return json(
      { error: "matricula_ambigua", mensagem: "Mais de um colaborador encontrado com esses dígitos. Procure o RH." },
      409
    );
  }

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

  // 3. Decide sozinho se é entrada ou saída, sem o técnico escolher.
  const hojeSp = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const { data: marcacoesHoje, error: marcacoesError } = await supabase
    .from("marcacoes_atendimento")
    .select("tipo")
    .eq("colaborador_id", colaborador.id)
    .eq("data_referencia", hojeSp);

  if (marcacoesError) return json({ error: "erro_consulta", mensagem: marcacoesError.message }, 500);

  const temEntrada = (marcacoesHoje ?? []).some((m) => m.tipo === "entrada");
  const temSaida = (marcacoesHoje ?? []).some((m) => m.tipo === "saida");

  let tipo: "entrada" | "saida";
  if (!temEntrada) {
    tipo = "entrada";
  } else if (exigeSaida && !temSaida) {
    tipo = "saida";
  } else {
    return json(
      {
        error: "atendimento_ja_registrado",
        mensagem: temSaida
          ? "Chegada e saída do atendimento de hoje já foram registradas."
          : "Chegada do atendimento de hoje já foi registrada.",
      },
      409
    );
  }

  // 4. Decodifica e sobe a foto
  const matches = foto_base64.match(/^data:(image\/(jpeg|png|webp));base64,([a-zA-Z0-9+/=]+)$/);
  if (!matches) {
    return json({ error: "foto_invalida", mensagem: "Formato de foto inválido." }, 400);
  }
  const mime = matches[1];
  const base64Data = matches[3];
  const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const extensao = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const marcacaoId = crypto.randomUUID();
  const fotoPath = `${colaborador.filial_id}/${colaborador.id}/atendimento-${tipo}-${marcacaoId}.${extensao}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fotoPath, bytes, { contentType: mime, upsert: false });

  if (uploadError) {
    return json({ error: "falha_upload_foto", mensagem: uploadError.message }, 500);
  }

  // 5. Geocodificação reversa — nunca bloqueia a marcação se falhar.
  const enderecoCompleto = await geocodificarReverso(latitude, longitude);

  // 6. Grava a marcação
  const { data: marcacao, error: insertError } = await supabase
    .from("marcacoes_atendimento")
    .insert({
      id: marcacaoId,
      colaborador_id: colaborador.id,
      filial_id: colaborador.filial_id,
      data_referencia: hojeSp,
      tipo,
      latitude,
      longitude,
      precisao_metros: precisao ?? null,
      foto_path: fotoPath,
      endereco_completo: enderecoCompleto,
    })
    .select("id, horario_registrado")
    .single();

  if (insertError) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([fotoPath]);
    if (removeError) {
      console.error(`falha ao remover foto órfã ${fotoPath}:`, removeError.message);
    }
    return json({ error: "falha_gravar_registro", mensagem: insertError.message }, 500);
  }

  return json({
    ok: true,
    colaborador_nome: colaborador.nome,
    tipo,
    horario_registrado: marcacao.horario_registrado,
  });
});
