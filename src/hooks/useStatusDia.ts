import { useCallback, useEffect, useState } from "react";
import * as statusDiaService from "@/services/statusDiaService";
import type { EventoStatusDia } from "@/lib/statusMachine";
import { TransicaoInvalidaError } from "@/lib/statusMachine";
import type { StatusDiaRegistro } from "@/types/status";

/**
 * Carrega e gerencia o status do dia de um colaborador numa data, expondo
 * ações que aplicam a máquina de estados do Módulo 6 (ver src/lib/statusMachine.ts).
 */
export function useStatusDia(colaboradorId: string | null, dataISO: string) {
  const [statusDia, setStatusDia] = useState<StatusDiaRegistro | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!colaboradorId) return;
    setCarregando(true);
    setErro(null);
    try {
      const registro = await statusDiaService.obterOuCriarStatusDia(colaboradorId, dataISO);
      setStatusDia(registro);
    } catch (err) {
      console.error(err);
      setErro("Não foi possível carregar o status do dia.");
    } finally {
      setCarregando(false);
    }
  }, [colaboradorId, dataISO]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const aplicar = useCallback(
    async (evento: EventoStatusDia) => {
      if (!statusDia) return;
      setEnviando(true);
      setErro(null);
      try {
        const atualizado = await statusDiaService.aplicarEvento(statusDia, evento);
        setStatusDia(atualizado);
        return atualizado;
      } catch (err) {
        if (err instanceof TransicaoInvalidaError) {
          setErro(err.message);
        } else {
          console.error(err);
          setErro("Não foi possível atualizar o status. Tente novamente.");
        }
        throw err;
      } finally {
        setEnviando(false);
      }
    },
    [statusDia]
  );

  return {
    statusDia,
    carregando,
    enviando,
    erro,
    recarregar: carregar,
    enviarCheckin: () => aplicar({ tipo: "ENVIAR_CHECKIN" }),
    aprovar: () => aplicar({ tipo: "APROVAR" }),
    rejeitar: () => aplicar({ tipo: "REJEITAR" }),
    marcarManual: (
      status: Extract<StatusDiaRegistro["status"], "PRESENTE" | "FALTA" | "ATESTADO" | "FOLGA" | "OUTROS">,
      opts?: { motivoOutros?: StatusDiaRegistro["motivo_outros"]; observacao?: string }
    ) =>
      aplicar({
        tipo: "MARCAR_MANUAL",
        status,
        motivoOutros: opts?.motivoOutros ?? undefined,
        observacao: opts?.observacao,
      }),
  };
}
