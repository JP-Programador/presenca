import { supabase } from "@/services/supabaseClient";

export interface ValidacaoAtendimento {
  encontrado: boolean;
  nome?: string;
  exige_saida?: boolean;
  tem_entrada_hoje?: boolean;
  tem_saida_hoje?: boolean;
}

export interface AtendimentoInput {
  codigoFilial: string;
  matricula4: string;
  fotoDataUrl: string;
  latitude: number;
  longitude: number;
  precisao?: number;
}

export interface AtendimentoResultado {
  ok: true;
  colaborador_nome: string;
  tipo: "entrada" | "saida";
  horario_registrado: string;
}

export interface AtendimentoErro {
  ok: false;
  mensagem: string;
}

/** Confirma o colaborador e devolve se a equipe dele exige saída + o que já foi registrado hoje (sem gravar nada). */
export async function validarAtendimento(codigoFilial: string, matricula4: string): Promise<ValidacaoAtendimento> {
  const { data, error } = await supabase.functions.invoke("validar-atendimento", {
    body: { codigo_filial: codigoFilial, matricula4 },
  });
  if (error || !data) return { encontrado: false };
  return data as ValidacaoAtendimento;
}

/** Chama a Edge Function `atendimento-publico` — o servidor decide sozinho se é chegada ou saída. */
export async function registrarAtendimento(
  input: AtendimentoInput
): Promise<AtendimentoResultado | AtendimentoErro> {
  const { data, error } = await supabase.functions.invoke("atendimento-publico", {
    body: {
      codigo_filial: input.codigoFilial,
      matricula4: input.matricula4,
      foto_base64: input.fotoDataUrl,
      latitude: input.latitude,
      longitude: input.longitude,
      precisao: input.precisao,
    },
  });

  if (error) {
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
    return { ok: false, mensagem: data.mensagem ?? "Não foi possível registrar o atendimento." };
  }
  return data as AtendimentoResultado;
}
