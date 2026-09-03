import { supabase } from "@/services/supabaseClient";

export interface CheckinInput {
  codigoFilial: string;
  matricula4: string; // 4 últimos dígitos da matrícula
  fotoDataUrl: string;
  latitude: number;
  longitude: number;
  precisao?: number;
  /** Só relevante quando o líder exige saída de atendimento — o técnico escolhe na tela. Omitido = servidor decide sozinho (times que não exigem saída, ou compatibilidade). */
  tipo?: "entrada" | "saida";
}

export interface CheckinResultado {
  ok: true;
  colaborador_nome: string;
  tipo: "entrada" | "saida";
  status?: "presente" | "atrasado"; // só presente quando tipo === "entrada"
  horario_registrado: string;
}

export interface CheckinErro {
  ok: false;
  mensagem: string;
}

export interface ValidacaoColaborador {
  encontrado: boolean;
  nome?: string;
  lider_nome?: string | null;
  equipe?: string | null;
  exige_saida?: boolean;
  /** Preview de qual vai ser a próxima marcação — checkin-publico revalida isso de verdade na hora de gravar. */
  proxima_marcacao?: "entrada" | "saida";
}

/** Confirma, enquanto o técnico digita, se existe um colaborador ativo pra essa filial+matrícula (sem gravar nada), e já devolve o que vai acontecer na próxima marcação. */
export async function validarColaborador(codigoFilial: string, matricula4: string): Promise<ValidacaoColaborador> {
  const { data, error } = await supabase.functions.invoke("validar-colaborador", {
    body: { codigo_filial: codigoFilial, matricula4 },
  });
  if (error || !data) return { encontrado: false };
  return data as ValidacaoColaborador;
}

/**
 * Chama a Edge Function `checkin-publico`, usada pela tela do técnico (sem
 * login) — porta de entrada única pra presença e atendimento. Quando o
 * líder exige saída de atendimento, o técnico escolhe entrada/saída na
 * tela e isso vai em `tipo`; o servidor ainda valida que a escolha faz
 * sentido (saída exige uma entrada em aberto).
 */
export async function enviarCheckin(input: CheckinInput): Promise<CheckinResultado | CheckinErro> {
  const { data, error } = await supabase.functions.invoke("checkin-publico", {
    body: {
      codigo_filial: input.codigoFilial,
      matricula4: input.matricula4,
      foto_base64: input.fotoDataUrl,
      latitude: input.latitude,
      longitude: input.longitude,
      precisao: input.precisao,
      tipo: input.tipo,
    },
  });

  if (error) {
    // Em resposta não-2xx da Edge Function, o supabase-js retorna data=null e
    // error=FunctionsHttpError — o corpo JSON (com a mensagem específica, ex.:
    // "matrícula ambígua", "já registrou presença hoje") vem em error.context
    // (a Response original), não em `data`.
    const contexto = (error as { context?: Response }).context;
    if (contexto) {
      try {
        const corpo = await contexto.clone().json();
        if (corpo?.mensagem) return { ok: false, mensagem: corpo.mensagem };
      } catch {
        // corpo não era JSON — segue para a mensagem genérica abaixo
      }
    }
    return { ok: false, mensagem: "Não foi possível enviar o registro. Verifique sua conexão e tente novamente." };
  }
  if (data?.error) {
    return { ok: false, mensagem: data.mensagem ?? "Não foi possível registrar." };
  }
  return data as CheckinResultado;
}
