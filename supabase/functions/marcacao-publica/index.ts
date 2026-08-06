// supabase/functions/marcacao-publica/index.ts
//
// Equivalente a checkin-publico, mas para o fluxo de 4 marcações diárias
// (Módulo 13 → agora com tela). Diferença principal: o técnico NÃO escolhe
// o tipo — o servidor calcula a próxima marcação esperada do dia
// (ENTRADA -> ALMOCO_SAIDA -> ALMOCO_RETORNO -> FINALIZACAO) e rejeita
// se as 4 já tiverem sido feitas ou se a ordem for violada.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { dentroDoLimite, extrairIp } from "../_shared/rateLimit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "tlp-fotos-presenca";
const ORDEM_MARCACOES = ["ENTRADA", "ALMOCO_SAIDA", "ALMOCO_RETORNO", "FINALIZACAO"] as const;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface MarcacaoPayload {
  codigo_filial: string;
  matricula4: string; // 4 últimos dígitos da matrícula
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

  let payload: MarcacaoPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "payload_invalido" }, 400);
  }

  const { codigo_filial, matricula4, foto_base64, latitude, longitude, precisao } = payload;

  if (
    !codigo_filial ||
    !matricula4 ||
    matricula4.length !== 4 ||
    !foto_base64 ||
    latitude == null ||
    longitude == null
  ) {
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
  // Mesmo raciocínio do checkin-publico: limite alto porque o IP costuma
  // ser compartilhado por toda a filial (Wi-Fi da empresa).
  if (!(await dentroDoLimite(supabase, "marcacao-publica", ip, 300, 300))) {
    return json(
      { error: "muitas_tentativas", mensagem: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
      429
    );
  }

  const { data: filial, error: filialError } = await supabase
    .from("filiais")
    .select("id")
    .eq("codigo", codigo_filial)
    .maybeSingle();

  if (filialError) {
    return json({ error: "erro_consulta", mensagem: filialError.message }, 500);
  }
  if (!filial) {
    return json({ error: "filial_nao_encontrada", mensagem: "Código da filial não encontrado." }, 404);
  }

  const { data: candidatos, error: colaboradorError } = await supabase
    .from("colaboradores")
    .select("id, filial_id, nome, ativo, matricula")
    .eq("filial_id", filial.id)
    .eq("ativo", true)
    .ilike("matricula", `%${matricula4}`);

  if (colaboradorError) {
    return json({ error: "erro_consulta", mensagem: colaboradorError.message }, 500);
  }

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

  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); // "YYYY-MM-DD"

  const { data: jaFeitas, error: marcacoesError } = await supabase
    .from("marcacoes_dia")
    .select("tipo")
    .eq("colaborador_id", colaborador.id)
    .eq("data_referencia", hoje);

  if (marcacoesError) {
    return json({ error: "erro_consulta", mensagem: marcacoesError.message }, 500);
  }

  const tiposFeitos = new Set((jaFeitas ?? []).map((m) => m.tipo));
  const proximoTipo = ORDEM_MARCACOES.find((t) => !tiposFeitos.has(t));

  if (!proximoTipo) {
    return json(
      { error: "marcacoes_completas", mensagem: "As 4 marcações de hoje já foram feitas." },
      409
    );
  }

  // Decodifica e sobe a foto
  const matches = foto_base64.match(/^data:(image\/(jpeg|png|webp));base64,([a-zA-Z0-9+/=]+)$/);
  if (!matches) {
    return json({ error: "foto_invalida", mensagem: "Formato de foto inválido." }, 400);
  }
  const mime = matches[1];
  const base64Data = matches[3];
  const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const extensao = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const marcacaoId = crypto.randomUUID();
  const fotoPath = `${colaborador.filial_id}/${colaborador.id}/${marcacaoId}.${extensao}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fotoPath, bytes, { contentType: mime, upsert: false });

  if (uploadError) {
    return json({ error: "falha_upload_foto", mensagem: uploadError.message }, 500);
  }

  const { data: marcacao, error: insertError } = await supabase
    .from("marcacoes_dia")
    .insert({
      id: marcacaoId,
      colaborador_id: colaborador.id,
      filial_id: colaborador.filial_id,
      data_referencia: hoje,
      tipo: proximoTipo,
      latitude,
      longitude,
      precisao_metros: precisao ?? null,
      foto_path: fotoPath,
    })
    .select("id, tipo, horario_registrado")
    .single();

  if (insertError) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([fotoPath]);
    if (removeError) {
      console.error(`falha ao remover foto órfã ${fotoPath}:`, removeError.message);
    }
    return json({ error: "falha_gravar_registro", mensagem: insertError.message }, 500);
  }

  // A primeira marcação do dia (ENTRADA) também move o status_dia para PENDENTE,
  // reaproveitando o mesmo fluxo de aprovação do Módulo 6/7.
  if (proximoTipo === "ENTRADA") {
    const { error: statusDiaError } = await supabase.rpc("marcar_status_dia_pendente", {
      p_colaborador_id: colaborador.id,
      p_registro_presenca_id: null,
    });
    if (statusDiaError) console.error("falha ao atualizar status_dia:", statusDiaError.message);
  }

  return json({
    ok: true,
    colaborador_nome: colaborador.nome,
    tipo: marcacao.tipo,
    horario_registrado: marcacao.horario_registrado,
    proxima_marcacao: ORDEM_MARCACOES.find((t) => t !== proximoTipo && !tiposFeitos.has(t)) ?? null,
    marcacoes_concluidas: tiposFeitos.size + 1 === 4,
  });
});
