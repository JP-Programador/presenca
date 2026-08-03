import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface ConfirmarStatusModalProps {
  nome: string;
  novoStatus: string;
  onConfirmar: () => Promise<void>;
  onCancelar: () => void;
}

/** Confirmação obrigatória antes de mudar manualmente o status do dia de um colaborador. */
export function ConfirmarStatusModal({ nome, novoStatus, onConfirmar, onCancelar }: ConfirmarStatusModalProps) {
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setEnviando(true);
    try {
      await onConfirmar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmar-status-titulo"
      onClick={onCancelar}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-4 rounded-t-lg bg-white p-5 shadow-lg sm:rounded-lg dark:bg-[#242424]"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 id="confirmar-status-titulo" className="text-base font-semibold text-ink dark:text-white">
            Confirmar mudança de status
          </h2>
          <p className="mt-1 text-sm text-ink/70 dark:text-white/70">
            Tem certeza que deseja marcar <strong>{nome}</strong> como <strong>{novoStatus}</strong>?
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" size="md" fullWidth onClick={onCancelar} disabled={enviando}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" fullWidth onClick={confirmar} loading={enviando}>
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
}
