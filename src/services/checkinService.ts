import { supabase } from "@/services/supabaseClient";
import type { TipoMarcacao } from "@/types/domain";

export interface CheckinInput {
  codigoFilial: string;
  matricula4: string; // 4 últimos dígitos da matrícula
  tipo: TipoMarcacao;
  fotoDataUrl: string;
  latitude: number;
  longitude: number;
  precisao?: number;
}

export interface CheckinResultado {
  ok: true;
  colaborador_nome: string;
  status: "presente" | "atrasado";
  horario_registrado: string;
}

export interface CheckinErro {
  ok: false;
  mensagem: string;
}

/** Chama a Edge Function `checkin-publico`, usada pela tela do técnico (sem login). */
export async function enviarCheckin(input: CheckinInput): Promise<CheckinResultado | CheckinErro> {
  const { data, error } = await supabase.functions.invoke("checkin-publico", {
    body: {
      codigo_filial: input.codigoFilial,
      matricula4: input.matricula4,
      tipo: input.tipo,
      foto_base64: input.fotoDataUrl,
      latitude: input.latitude,
      longitude: input.longitude,
      precisao: input.precisao,
    },
  });

  if (error) {
    return { ok: false, mensagem: "Não foi possível enviar a presença. Verifique sua conexão e tente novamente." };
  }
  if (data?.error) {
    return { ok: false, mensagem: data.mensagem ?? "Não foi possível registrar a presença." };
  }
  return data as CheckinResultado;
}
