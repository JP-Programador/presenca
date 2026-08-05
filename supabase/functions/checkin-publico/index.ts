// supabase/functions/checkin-publico/index.ts
//
// Endpoint público chamado pela tela do técnico (sem autenticação de usuário).
// Identificação: código da filial + 4 últimos dígitos da matrícula (fácil de
// digitar em campo — trocado do esquema anterior "matrícula completa + 4
// dígitos do CPF" a pedido, ver ENTREGA_MODULOS_5_15.md). Junto com tipo de
// marcação, foto (base64) e coordenadas GPS — todos obrigatórios — valida o
// colaborador, sobe a foto para o Storage e grava o registro de presença
// usando a service_role key (por isso não depende de policies de RLS para
// papéis anônimos, mantendo o modelo de acesso das migrations 0005/0006
// restrito a usuários autenticados do painel administrativo).

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { dentroDoLimite, extrairIp } from "../_shared/rateLimit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "tlp-fotos-presenca";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CheckinPayload {
  codigo_filial: string;
  matricula4: string; // 4 últimos dígitos da matrícula
  tipo: "entrada" | "inicio_intervalo" | "fim_intervalo" | "saida";
  foto_base64: string; // dataURL completa (image/jpeg;base64,...)
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  let payload: CheckinPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "payload_invalido" }, 400);
  }

  const { codigo_filial, matricula4, tipo, foto_base64, latitude, longitude, precisao } = payload;

  if (
    !codigo_filial ||
    !matricula4 ||
    matricula4.length !== 4 ||
    !tipo ||
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
  if (!(await dentroDoLimite(supabase, "checkin-publico", ip, 10, 300))) {
    return json(
      { error: "muitas_tentativas", mensagem: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
      429
    );
  }

  // 1. Localiza a filial pelo código
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

  // 2. Localiza e valida o colaborador pelos 4 últimos dígitos da matrícula,
  // dentro da filial informada (a matrícula é única por filial — ver
  // colaboradores_matricula_filial_unique — mas dois colaboradores de uma
  // mesma filial podem, em tese, ter matrículas diferentes terminando nos
  // mesmos 4 dígitos; nesse caso raro, tratamos como ambíguo por segurança).
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
    return json(
      { error: "colaborador_nao_encontrado", mensagem: "Filial ou matrícula não conferem." },
      404
    );
  }
  if (encontrados.length > 1) {
    return json(
      {
        error: "matricula_ambigua",
        mensagem: "Mais de um colaborador encontrado com esses dígitos. Procure o RH.",
      },
      409
    );
  }

  const colaborador = encontrados[0];

  // 2. Calcula status comparando com a escala do dia (se existir)
  const agora = new Date();
  const diaSemana = agora.getDay();
  let status: "presente" | "atrasado" = "presente";
  let horarioPrevisto: string | null = null;

  if (tipo === "entrada") {
    const { data: escala } = await supabase
      .from("escalas")
      .select("hora_entrada, tolerancia_min")
      .eq("colaborador_id", colaborador.id)
      .eq("dia_semana", diaSemana)
      .eq("ativo", true)
      .maybeSingle();

    if (escala) {
      horarioPrevisto = escala.hora_entrada;
      const [h, m] = escala.hora_entrada.split(":").map(Number);
      const previsto = new Date(agora);
      previsto.setHours(h, m, 0, 0);
      previsto.setMinutes(previsto.getMinutes() + (escala.tolerancia_min ?? 0));
      if (agora > previsto) status = "atrasado";
    }
  }

  // 3. Decodifica e sobe a foto para o Storage
  const matches = foto_base64.match(/^data:(image\/(jpeg|png|webp));base64,([a-zA-Z0-9+/=]+)$/);
  if (!matches) {
    return json({ error: "foto_invalida", mensagem: "Formato de foto inválido." }, 400);
  }
  const mime = matches[1];
  const base64Data = matches[3];
  const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const extensao = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const registroId = crypto.randomUUID();
  const fotoPath = `${colaborador.filial_id}/${colaborador.id}/${registroId}.${extensao}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fotoPath, bytes, { contentType: mime, upsert: false });

  if (uploadError) {
    return json({ error: "falha_upload_foto", mensagem: uploadError.message }, 500);
  }

  // 4. Grava o registro de presença
  const { data: registro, error: insertError } = await supabase
    .from("registros_presenca")
    .insert({
      id: registroId,
      colaborador_id: colaborador.id,
      filial_id: colaborador.filial_id,
      tipo,
      status,
      horario_previsto: horarioPrevisto,
      latitude,
      longitude,
      precisao_metros: precisao ?? null,
      foto_path: fotoPath,
    })
    .select("id, status, horario_registrado")
    .single();

  if (insertError) {
    // desfaz o upload se não conseguiu gravar o registro, para não deixar foto órfã
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([fotoPath]);
    if (removeError) {
      console.error(`falha ao remover foto órfã ${fotoPath}:`, removeError.message);
    }
    return json({ error: "falha_gravar_registro", mensagem: insertError.message }, 500);
  }

  // 5. Move o status do dia (Módulo 6) de FALTA/FOLGA para PENDENTE
  const { error: statusDiaError } = await supabase.rpc("marcar_status_dia_pendente", {
    p_colaborador_id: colaborador.id,
    p_registro_presenca_id: registro.id,
  });
  if (statusDiaError) {
    // não desfaz o check-in por isso — o registro de presença já é a fonte
    // primária; o status_dia pode ser corrigido manualmente pelo líder.
    console.error("falha ao atualizar status_dia:", statusDiaError.message);
  }

  return json({
    ok: true,
    colaborador_nome: colaborador.nome,
    status: registro.status,
    horario_registrado: registro.horario_registrado,
  });
});
