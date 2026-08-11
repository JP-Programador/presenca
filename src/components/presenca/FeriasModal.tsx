import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { PreviewFerias } from "@/services/statusDiaService";

interface FeriasModalProps {
  nome: string;
  /** Chama a RPC (sobrescrever=false na 1ª tentativa) e devolve o preview dia a dia. */
  onAplicar: (dataInicio: string, dataFim: string, observacao: string) => Promise<PreviewFerias[]>;
  /** Chamado quando o preview volta com conflitos, pra abrir o modal de confirmação de sobrescrita. */
  onConflito: (dataInicio: string, dataFim: string, observacao: string, diasConflito: string[]) => void;
  onFechar: () => void;
}

/** Modal pra lançar férias num intervalo de datas de uma vez, sem marcar dia a dia. */
export function FeriasModal({ nome, onAplicar, onConflito, onFechar }: FeriasModalProps) {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    if (!dataInicio || !dataFim) {
      setErro("Informe a data de início e a data de fim.");
      return;
    }
    if (dataFim < dataInicio) {
      setErro("A data de fim não pode ser anterior à data de início.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const preview = await onAplicar(dataInicio, dataFim, observacao.trim());
      const diasConflito = preview.filter((p) => p.conflito).map((p) => p.data_referencia);
      if (diasConflito.length > 0) {
        onConflito(dataInicio, dataFim, observacao.trim(), diasConflito);
        return;
      }
      onFechar();
    } catch {
      setErro("Não foi possível aplicar as férias. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ferias-titulo"
      onClick={onFechar}
    >
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-t-lg bg-white p-5 shadow-lg sm:rounded-lg dark:bg-[#242424]"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 id="ferias-titulo" className="text-base font-semibold text-ink dark:text-white">
            Lançar férias — {nome}
          </h2>
          <p className="text-xs text-ink/50 dark:text-white/50">
            Marca automaticamente todos os dias do período como Férias, sem precisar marcar um a um.
          </p>
        </div>

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="ferias-inicio" className="text-xs font-semibold text-ink/70 dark:text-white/70">
              Início
            </label>
            <input
              id="ferias-inicio"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="h-11 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15 dark:bg-[#1A1A1A] dark:text-white"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="ferias-fim" className="text-xs font-semibold text-ink/70 dark:text-white/70">
              Fim
            </label>
            <input
              id="ferias-fim"
              type="date"
              value={dataFim}
              min={dataInicio || undefined}
              onChange={(e) => setDataFim(e.target.value)}
              className="h-11 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15 dark:bg-[#1A1A1A] dark:text-white"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="ferias-observacao" className="text-xs font-semibold text-ink/70 dark:text-white/70">
            Observação
          </label>
          <textarea
            id="ferias-observacao"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            placeholder="Opcional"
            className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15 dark:bg-[#1A1A1A] dark:text-white"
          />
        </div>

        {erro && <p className="text-xs font-medium text-danger">{erro}</p>}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" size="md" fullWidth onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" fullWidth onClick={confirmar} loading={enviando}>
            Aplicar
          </Button>
        </div>
      </div>
    </div>
  );
}
