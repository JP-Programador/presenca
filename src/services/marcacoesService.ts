// Módulo 13 — service do fluxo de 4 marcações (banco: migration 0024;
// tela pública: TecnicoMarcacoes.tsx via a Edge Function marcacao-publica).

import { supabase } from "@/services/supabaseClient";
import type { MarcacaoDia, TipoMarcacaoDia } from "@/types/marcacoes";

/** As marcações já registradas por um colaborador num dia (0 a 4 linhas). */
export async function listarMarcacoesDoDia(
  colaboradorId: string,
  dataISO: string
): Promise<MarcacaoDia[]> {
  const { data, error } = await supabase
    .from("marcacoes_dia")
    .select(
      "id, colaborador_id, filial_id, data_referencia, tipo, horario_registrado, latitude, longitude, precisao_metros, foto_path, observacao, created_at"
    )
    .eq("colaborador_id", colaboradorId)
    .eq("data_referencia", dataISO)
    .order("horario_registrado", { ascending: true });

  if (error) throw error;
  return (data ?? []) as MarcacaoDia[];
}

export interface RegistrarMarcacaoInput {
  colaboradorId: string;
  filialId: string;
  dataISO: string;
  tipo: TipoMarcacaoDia;
  latitude: number;
  longitude: number;
  precisaoMetros?: number;
  fotoPath?: string;
  observacao?: string;
}

/** Registra uma das 4 marcações do dia. Falha se o tipo já foi registrado nessa data (constraint unique). */
export async function registrarMarcacao(input: RegistrarMarcacaoInput): Promise<MarcacaoDia> {
  const { data, error } = await supabase
    .from("marcacoes_dia")
    .insert({
      colaborador_id: input.colaboradorId,
      filial_id: input.filialId,
      data_referencia: input.dataISO,
      tipo: input.tipo,
      latitude: input.latitude,
      longitude: input.longitude,
      precisao_metros: input.precisaoMetros ?? null,
      foto_path: input.fotoPath ?? null,
      observacao: input.observacao ?? null,
    })
    .select(
      "id, colaborador_id, filial_id, data_referencia, tipo, horario_registrado, latitude, longitude, precisao_metros, foto_path, observacao, created_at"
    )
    .single();

  if (error) throw error;
  return data as MarcacaoDia;
}

/** Próxima marcação esperada dado o que já foi feito hoje — usado pela tela para saber qual botão mostrar. */
export function proximaMarcacaoEsperada(jaFeitas: TipoMarcacaoDia[]): TipoMarcacaoDia | null {
  const ordem: TipoMarcacaoDia[] = ["ENTRADA", "ALMOCO_SAIDA", "ALMOCO_RETORNO", "FINALIZACAO"];
  return ordem.find((tipo) => !jaFeitas.includes(tipo)) ?? null;
}

export interface MarcacaoPublicaInput {
  codigoFilial: string;
  matricula4: string; // 4 últimos dígitos da matrícula
  fotoDataUrl: string;
  latitude: number;
  longitude: number;
  precisao?: number;
}

export interface MarcacaoPublicaResultado {
  ok: true;
  colaborador_nome: string;
  tipo: TipoMarcacaoDia;
  horario_registrado: string;
  proxima_marcacao: TipoMarcacaoDia | null;
  marcacoes_concluidas: boolean;
}

export interface MarcacaoPublicaErro {
  ok: false;
  mensagem: string;
}

/** Chama a Edge Function `marcacao-publica` (tela pública, sem login) — o servidor decide qual das 4 marcações é a próxima. */
export async function enviarMarcacaoPublica(
  input: MarcacaoPublicaInput
): Promise<MarcacaoPublicaResultado | MarcacaoPublicaErro> {
  const { data, error } = await supabase.functions.invoke("marcacao-publica", {
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
    return { ok: false, mensagem: "Não foi possível enviar a marcação. Verifique sua conexão e tente novamente." };
  }
  if (data?.error) {
    return { ok: false, mensagem: data.mensagem ?? "Não foi possível registrar a marcação." };
  }
  return data as MarcacaoPublicaResultado;
}
