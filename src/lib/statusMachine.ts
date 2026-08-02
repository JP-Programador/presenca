// Máquina de estados do "status do dia" (Módulo 6).
// Espelha, em TypeScript puro, a validação feita em
// supabase/migrations/0018_status_dia.sql (tlp_presenca.transicionar_status_dia) —
// usada no frontend para validar ANTES de chamar o backend (feedback
// imediato de UI) e para desenhar quais ações estão disponíveis em cada
// estado. A fonte de verdade da regra continua sendo o banco.

import type { TipoDiaCalendario } from "@/types/domain";
import type { MotivoOutros, StatusDia } from "@/types/status";

export type EventoStatusDia =
  | { tipo: "ENVIAR_CHECKIN" }
  | { tipo: "APROVAR" }
  | { tipo: "REJEITAR" }
  | { tipo: "MARCAR_MANUAL"; status: Extract<StatusDia, "PRESENTE" | "FALTA" | "ATESTADO" | "FOLGA" | "OUTROS">; motivoOutros?: MotivoOutros; observacao?: string };

export class TransicaoInvalidaError extends Error {}

/** FALTA em dia útil, FOLGA em fim de semana/feriado — o "estado de repouso" do dia. */
export function estadoInicial(tipoDia: TipoDiaCalendario): StatusDia {
  return tipoDia === "UTIL" ? "FALTA" : "FOLGA";
}

/**
 * Aplica um evento ao status atual e retorna o novo status, ou lança
 * TransicaoInvalidaError se a transição não é permitida.
 */
export function transicionar(
  statusAtual: StatusDia,
  tipoDia: TipoDiaCalendario,
  evento: EventoStatusDia
): StatusDia {
  const repouso = estadoInicial(tipoDia);

  switch (evento.tipo) {
    case "ENVIAR_CHECKIN":
      if (statusAtual !== "FALTA" && statusAtual !== "FOLGA") {
        throw new TransicaoInvalidaError(
          `Só é possível enviar presença a partir de FALTA/FOLGA (atual: ${statusAtual}).`
        );
      }
      return "PENDENTE";

    case "APROVAR":
      if (statusAtual !== "PENDENTE") {
        throw new TransicaoInvalidaError(`Só é possível aprovar um status PENDENTE (atual: ${statusAtual}).`);
      }
      return "PRESENTE";

    case "REJEITAR":
      if (statusAtual !== "PENDENTE") {
        throw new TransicaoInvalidaError(`Só é possível rejeitar um status PENDENTE (atual: ${statusAtual}).`);
      }
      return repouso;

    case "MARCAR_MANUAL":
      if (evento.status === "OUTROS" && !evento.motivoOutros) {
        throw new TransicaoInvalidaError("Status OUTROS exige um motivo.");
      }
      // Ações manuais do líder podem ser aplicadas a partir de qualquer estado
      // (ex.: corrigir um PRESENTE indevido para FALTA, ou uma FALTA para ATESTADO).
      // FALTA/FOLGA são sempre resolvidos para o repouso do dia: feriado/fim de
      // semana conta como FOLGA automaticamente, mesmo que o líder peça FALTA
      // (o servidor recalcula da mesma forma — ver transicionar_status_dia).
      if (evento.status === "FALTA" || evento.status === "FOLGA") {
        return repouso;
      }
      return evento.status;

    default:
      throw new TransicaoInvalidaError("Evento desconhecido.");
  }
}

/** Quais ações fazem sentido oferecer na UI para o estado atual (Módulo 7). */
export function acoesDisponiveis(statusAtual: StatusDia): EventoStatusDia["tipo"][] {
  if (statusAtual === "PENDENTE") return ["APROVAR", "REJEITAR"];
  return ["MARCAR_MANUAL"];
}
