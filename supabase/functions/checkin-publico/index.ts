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
import { distanciaKm } from "../_shared/geo.ts";

const RAIO_ALERTA_RESIDENCIA_KM = 2;

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
  // Limite por IP, não por pessoa — muitos colaboradores da mesma
  // filial/rede batem ponto pelo mesmo IP público (NAT do Wi-Fi da empresa),
  // então precisa ser alto o bastante pra nunca travar um pico legítimo de
  // check-ins simultâneos (ex.: início de turno), mas ainda limitar uma
  // varredura de força bruta nos 4 dígitos da matrícula.
  if (!(await dentroDoLimite(supabase, "checkin-publico", ip, 300, 300))) {
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
    .select("id, filial_id, nome, ativo, matricula, lider_id, latitude, longitude, localizacao_precisao")
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

  // 2.1. Uma foto de "entrada" (presença) por colaborador por dia — os demais
  // tipos (intervalo/saída) não têm esse limite. Olha o status_dia ATUAL, não
  // se já existe algum registro de entrada hoje: se o líder rejeitou o
  // check-in anterior, o status_dia volta pra FALTA/FOLGA e o colaborador
  // pode tentar de novo — só bloqueia quando ainda há uma entrada pendente
  // de aprovação ou já aprovada (PENDENTE/PRESENTE).
  if (tipo === "entrada") {
    const hojeSp = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const { data: statusDiaAtual, error: statusDiaError } = await supabase
      .from("status_dia")
      .select("status")
      .eq("colaborador_id", colaborador.id)
      .eq("data_referencia", hojeSp)
      .maybeSingle();

    if (statusDiaError) {
      return json({ error: "erro_consulta", mensagem: statusDiaError.message }, 500);
    }
    if (statusDiaAtual?.status === "PENDENTE" || statusDiaAtual?.status === "PRESENTE") {
      return json(
        {
          error: "presenca_ja_registrada",
          mensagem:
            statusDiaAtual.status === "PENDENTE"
              ? "Sua presença de hoje já foi registrada e está aguardando aprovação."
              : "Sua presença de hoje já foi aprovada.",
        },
        409
      );
    }
  }

  // 3. Calcula status comparando com a escala do dia (se existir)
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

  // 4. Decodifica e sobe a foto para o Storage
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

  // 5. Grava o registro de presença
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

  // 6. Move o status do dia (Módulo 6) de FALTA/FOLGA para PENDENTE
  const { error: statusDiaError } = await supabase.rpc("marcar_status_dia_pendente", {
    p_colaborador_id: colaborador.id,
    p_registro_presenca_id: registro.id,
  });
  if (statusDiaError) {
    // não desfaz o check-in por isso — o registro de presença já é a fonte
    // primária; o status_dia pode ser corrigido manualmente pelo líder.
    console.error("falha ao atualizar status_dia:", statusDiaError.message);
  }

  // 7. Alerta (não bloqueia o check-in): se o colaborador tem residência
  // geocodificada e o check-in aconteceu perto de casa, avisa o líder
  // direto e o coordenador dele (se houver) — mesma tabela "alertas" já
  // usada pela feature de férias.
  // "cidade" é grosseiro demais (pode estar a dezenas de km da casa real) —
  // ignora esse nível de precisão pro alerta de 2km, senão vira alarme
  // essencialmente aleatório.
  if (colaborador.latitude != null && colaborador.longitude != null && colaborador.localizacao_precisao !== "cidade") {
    const distancia = distanciaKm(latitude, longitude, colaborador.latitude, colaborador.longitude);
    if (distancia <= RAIO_ALERTA_RESIDENCIA_KM) {
      const destinatarios = new Set<string>();
      if (colaborador.lider_id) {
        destinatarios.add(colaborador.lider_id);
        const { data: lider } = await supabase
          .from("perfis")
          .select("coordenador_id")
          .eq("id", colaborador.lider_id)
          .maybeSingle();
        if (lider?.coordenador_id) destinatarios.add(lider.coordenador_id);
      }
      const detalhes = {
        distancia_km: Math.round(distancia * 100) / 100,
        tipo_marcacao: tipo,
        registro_presenca_id: registro.id,
        data_referencia: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
      };
      if (destinatarios.size > 0) {
        const { error: alertaError } = await supabase.from("alertas").insert(
          [...destinatarios].map((destinatarioId) => ({
            tipo: "checkin_proximo_residencia",
            colaborador_id: colaborador.id,
            destinatario_id: destinatarioId,
            detalhes,
          }))
        );
        if (alertaError) {
          console.error("falha ao registrar alerta de check-in próximo da residência:", alertaError.message);
        }
      }
    }
  }

  return json({
    ok: true,
    colaborador_nome: colaborador.nome,
    status: registro.status,
    horario_registrado: registro.horario_registrado,
  });
});
