import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface ConflitoFeriasModalProps {
  nome: string;
  diasConflito: string[];
  onSobrescrever: () => Promise<void>;
  onCancelar: () => void;
}

/** Alerta quando o período de férias cruza com dias que já têm registro — pede confirmação explícita antes de sobrescrever. */
export function ConflitoFeriasModal({ nome, diasConflito, onSobrescrever, onCancelar }: ConflitoFeriasModalProps) {
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setEnviando(true);
    try {
      await onSobrescrever();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[2100] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflito-ferias-titulo"
      onClick={onCancelar}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-4 rounded-t-lg bg-white p-5 shadow-lg sm:rounded-lg dark:bg-[#242424]"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 id="conflito-ferias-titulo" className="text-base font-semibold text-ink dark:text-white">
            Já existe registro nesses dias
          </h2>
          <p className="mt-1 text-sm text-ink/70 dark:text-white/70">
            <strong>{nome}</strong> já tem status lançado (check-in ou marcação manual) em{" "}
            {diasConflito.length === 1 ? "1 dia" : `${diasConflito.length} dias`} desse período:
          </p>
        </div>

        <ul className="max-h-32 overflow-y-auto rounded-md border border-ink/10 px-3 py-2 text-xs text-ink/70 dark:border-white/10 dark:text-white/70">
          {diasConflito.map((d) => (
            <li key={d}>{new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR")}</li>
          ))}
        </ul>

        <p className="text-xs text-ink/50 dark:text-white/50">
          O coordenador será avisado dessa sobrescrita. Os demais dias do período, sem conflito, também serão
          aplicados.
        </p>

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" size="md" fullWidth onClick={onCancelar} disabled={enviando}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" fullWidth onClick={confirmar} loading={enviando}>
            Sobrescrever
          </Button>
        </div>
      </div>
    </div>
  );
}
