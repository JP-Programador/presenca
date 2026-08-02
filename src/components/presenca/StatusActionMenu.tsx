import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { OutrosStatusModal } from "@/components/presenca/OutrosStatusModal";
import type { MotivoOutros, StatusDia } from "@/types/status";

type StatusManual = Extract<StatusDia, "PRESENTE" | "FALTA" | "ATESTADO" | "FOLGA" | "OUTROS">;

const ACOES_MANUAIS: { status: StatusManual; label: string; variant: "primary" | "secondary" | "danger" }[] = [
  { status: "PRESENTE", label: "Presente", variant: "primary" },
  { status: "FALTA", label: "Falta", variant: "danger" },
  { status: "ATESTADO", label: "Atestado", variant: "secondary" },
  { status: "FOLGA", label: "Folga", variant: "secondary" },
  { status: "OUTROS", label: "Outros", variant: "secondary" },
];

interface StatusActionMenuProps {
  nome: string;
  statusAtual: StatusDia;
  desabilitado?: boolean;
  onAprovar: () => Promise<void>;
  onRejeitar: () => Promise<void>;
  onMarcarManual: (status: StatusManual, opts?: { motivoOutros?: MotivoOutros; observacao?: string }) => Promise<void>;
}

/** Ações rápidas de status do dia no dashboard do líder (Módulo 7). */
export function StatusActionMenu({
  nome,
  statusAtual,
  desabilitado,
  onAprovar,
  onRejeitar,
  onMarcarManual,
}: StatusActionMenuProps) {
  const [processando, setProcessando] = useState<string | null>(null);
  const [modalOutrosAberto, setModalOutrosAberto] = useState(false);

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
      <div className="flex flex-wrap gap-2">
        {ACOES_MANUAIS.filter((a) => a.status !== statusAtual).map((a) => (
          <Button
            key={a.status}
            variant={a.variant}
            size="md"
            disabled={desabilitado || processando !== null}
            loading={processando === a.status}
            onClick={() => {
              if (a.status === "OUTROS") {
                setModalOutrosAberto(true);
                return;
              }
              executar(a.status, () => onMarcarManual(a.status));
            }}
          >
            {a.label}
          </Button>
        ))}
      </div>

      {modalOutrosAberto && (
        <OutrosStatusModal
          nome={nome}
          onFechar={() => setModalOutrosAberto(false)}
          onConfirmar={async (motivo, observacao) => {
            await executar("OUTROS", () => onMarcarManual("OUTROS", { motivoOutros: motivo, observacao }));
          }}
        />
      )}
    </>
  );
}
