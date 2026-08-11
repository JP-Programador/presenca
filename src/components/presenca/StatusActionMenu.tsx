import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { OutrosStatusModal } from "@/components/presenca/OutrosStatusModal";
import { ConfirmarStatusModal } from "@/components/presenca/ConfirmarStatusModal";
import { FeriasModal } from "@/components/presenca/FeriasModal";
import { ConflitoFeriasModal } from "@/components/presenca/ConflitoFeriasModal";
import { STATUS_DIA_LABEL, type MotivoOutros, type StatusDia } from "@/types/status";
import type { PreviewFerias } from "@/services/statusDiaService";

type StatusManual = Extract<StatusDia, "PRESENTE" | "FALTA" | "ATESTADO" | "FOLGA" | "OUTROS">;

const ACOES_MANUAIS: { status: StatusManual; label: string }[] = [
  { status: "PRESENTE", label: "Presente" },
  { status: "FALTA", label: "Falta" },
  { status: "ATESTADO", label: "Atestado" },
  { status: "FOLGA", label: "Folga" },
  { status: "OUTROS", label: "Outros" },
];

interface ConflitoFeriasPendente {
  dataInicio: string;
  dataFim: string;
  observacao: string;
  diasConflito: string[];
}

interface StatusActionMenuProps {
  nome: string;
  statusAtual: StatusDia;
  motivoOutrosAtual?: MotivoOutros | null;
  desabilitado?: boolean;
  /** Exige confirmação num modal antes de aplicar a mudança de status manual (usado na coordenação). */
  pedirConfirmacao?: boolean;
  onAprovar: () => Promise<void>;
  onRejeitar: () => Promise<void>;
  onMarcarManual: (status: StatusManual, opts?: { motivoOutros?: MotivoOutros; observacao?: string }) => Promise<void>;
  /** Presente = habilita o botão "Férias" (lançamento em lote por intervalo de datas). */
  onAplicarFerias?: (
    dataInicio: string,
    dataFim: string,
    observacao: string,
    sobrescrever: boolean
  ) => Promise<PreviewFerias[]>;
  onCancelarFerias?: () => Promise<void>;
}

/** Ações rápidas de status do dia no dashboard do líder (Módulo 7). */
export function StatusActionMenu({
  nome,
  statusAtual,
  motivoOutrosAtual,
  desabilitado,
  pedirConfirmacao,
  onAprovar,
  onRejeitar,
  onMarcarManual,
  onAplicarFerias,
  onCancelarFerias,
}: StatusActionMenuProps) {
  const [processando, setProcessando] = useState<string | null>(null);
  const [modalOutrosAberto, setModalOutrosAberto] = useState(false);
  const [confirmacaoPendente, setConfirmacaoPendente] = useState<StatusManual | null>(null);
  const [modalFeriasAberto, setModalFeriasAberto] = useState(false);
  const [conflitoFerias, setConflitoFerias] = useState<ConflitoFeriasPendente | null>(null);
  const [cancelandoFerias, setCancelandoFerias] = useState(false);

  const emFerias = statusAtual === "OUTROS" && motivoOutrosAtual === "Férias";

  async function executar(chave: string, acao: () => Promise<void>) {
    setProcessando(chave);
    try {
      await acao();
    } finally {
      setProcessando(null);
    }
  }

  if (statusAtual === "PENDENTE") {
    return (
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="md"
          fullWidth
          disabled={desabilitado || processando !== null}
          loading={processando === "rejeitar"}
          onClick={() => executar("rejeitar", onRejeitar)}
        >
          Rejeitar
        </Button>
        <Button
          variant="primary"
          size="md"
          fullWidth
          disabled={desabilitado || processando !== null}
          loading={processando === "aprovar"}
          onClick={() => executar("aprovar", onAprovar)}
        >
          Aprovar
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink/40 dark:text-white/40">
            Status atual:
          </span>
          <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-white dark:bg-white dark:text-ink">
            {STATUS_DIA_LABEL[statusAtual]}
          </span>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/40 dark:text-white/40">
          Mudar status:
        </p>
        <div className="flex flex-wrap gap-2">
          {ACOES_MANUAIS.filter((a) => a.status !== statusAtual).map((a) => (
            <Button
              key={a.status}
              variant="secondary"
              size="md"
              disabled={desabilitado || processando !== null}
              loading={processando === a.status}
              onClick={() => {
                if (a.status === "OUTROS") {
                  setModalOutrosAberto(true);
                  return;
                }
                if (pedirConfirmacao) {
                  setConfirmacaoPendente(a.status);
                  return;
                }
                executar(a.status, () => onMarcarManual(a.status));
              }}
            >
              {a.label}
            </Button>
          ))}
          {onAplicarFerias && !emFerias && (
            <Button
              variant="secondary"
              size="md"
              disabled={desabilitado || processando !== null}
              onClick={() => setModalFeriasAberto(true)}
            >
              Férias
            </Button>
          )}
          {onCancelarFerias && emFerias && (
            <Button
              variant="secondary"
              size="md"
              disabled={desabilitado || cancelandoFerias}
              loading={cancelandoFerias}
              onClick={async () => {
                setCancelandoFerias(true);
                try {
                  await onCancelarFerias();
                } finally {
                  setCancelandoFerias(false);
                }
              }}
            >
              Cancelar férias
            </Button>
          )}
        </div>
      </div>

      {modalFeriasAberto && onAplicarFerias && (
        <FeriasModal
          nome={nome}
          onFechar={() => setModalFeriasAberto(false)}
          onAplicar={(dataInicio, dataFim, observacao) => onAplicarFerias(dataInicio, dataFim, observacao, false)}
          onConflito={(dataInicio, dataFim, observacao, diasConflito) => {
            setModalFeriasAberto(false);
            setConflitoFerias({ dataInicio, dataFim, observacao, diasConflito });
          }}
        />
      )}

      {conflitoFerias && onAplicarFerias && (
        <ConflitoFeriasModal
          nome={nome}
          diasConflito={conflitoFerias.diasConflito}
          onCancelar={() => setConflitoFerias(null)}
          onSobrescrever={async () => {
            await onAplicarFerias(
              conflitoFerias.dataInicio,
              conflitoFerias.dataFim,
              conflitoFerias.observacao,
              true
            );
            setConflitoFerias(null);
          }}
        />
      )}

      {modalOutrosAberto && (
        <OutrosStatusModal
          nome={nome}
          onFechar={() => setModalOutrosAberto(false)}
          onConfirmar={async (motivo, observacao) => {
            await executar("OUTROS", () => onMarcarManual("OUTROS", { motivoOutros: motivo, observacao }));
          }}
        />
      )}

      {confirmacaoPendente && (
        <ConfirmarStatusModal
          nome={nome}
          novoStatus={STATUS_DIA_LABEL[confirmacaoPendente]}
          onCancelar={() => setConfirmacaoPendente(null)}
          onConfirmar={async () => {
            const status = confirmacaoPendente;
            setConfirmacaoPendente(null);
            await executar(status, () => onMarcarManual(status));
          }}
        />
      )}
    </>
  );
}
