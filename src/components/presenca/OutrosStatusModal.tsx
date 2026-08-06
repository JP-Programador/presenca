import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { MOTIVOS_OUTROS, type MotivoOutros } from "@/types/status";

interface OutrosStatusModalProps {
  nome: string;
  onConfirmar: (motivo: MotivoOutros, observacao: string) => Promise<void>;
  onFechar: () => void;
}

/** Modal obrigatório ao marcar um colaborador como "OUTROS" (Módulo 7). */
export function OutrosStatusModal({ nome, onConfirmar, onFechar }: OutrosStatusModalProps) {
  const [motivo, setMotivo] = useState<MotivoOutros | "">("");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    if (!motivo) {
      setErro("Selecione um motivo.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await onConfirmar(motivo, observacao.trim());
      onFechar();
    } catch {
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="outros-status-titulo"
      onClick={onFechar}
    >
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-t-lg bg-white p-5 shadow-lg sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 id="outros-status-titulo" className="text-base font-semibold text-ink">
            Marcar "Outros" — {nome}
          </h2>
          <p className="text-xs text-ink/50">Motivo e observação são obrigatórios para esse status.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="outros-motivo" className="text-xs font-semibold text-ink/70">
            Motivo
          </label>
          <select
            id="outros-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value as MotivoOutros)}
            className="h-11 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="" disabled>
              Selecione...
            </option>
            {MOTIVOS_OUTROS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="outros-observacao" className="text-xs font-semibold text-ink/70">
            Observação
          </label>
          <textarea
            id="outros-observacao"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            placeholder="Detalhe o motivo (opcional, mas recomendado)"
            className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        {erro && <p className="text-xs font-medium text-danger">{erro}</p>}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" size="md" fullWidth onClick={onFechar} disabled={enviando}>
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
