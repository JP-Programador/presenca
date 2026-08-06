import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { atualizarColaborador } from "@/services/colaboradoresService";

interface ExcluirColaboradorButtonProps {
  colaboradorId: string;
  nome: string;
  ativo: boolean;
  onAtualizado: () => void;
}

/** Inativa (soft-delete) um colaborador — preserva o histórico de presença/faltas já registrado. */
export function ExcluirColaboradorButton({ colaboradorId, nome, ativo, onAtualizado }: ExcluirColaboradorButtonProps) {
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!ativo) {
    return (
      <Button
        variant="ghost"
        size="md"
        loading={enviando}
        onClick={async () => {
          setEnviando(true);
          try {
            await atualizarColaborador(colaboradorId, { ativo: true });
            onAtualizado();
          } finally {
            setEnviando(false);
          }
        }}
      >
        Reativar
      </Button>
    );
  }

  if (!confirmando) {
    return (
      <Button variant="ghost" size="md" onClick={() => setConfirmando(true)}>
        Excluir
      </Button>
    );
  }

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    try {
      await atualizarColaborador(colaboradorId, { ativo: false });
      onAtualizado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível excluir o colaborador.");
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-ink/70 dark:text-white/70">Excluir {nome.split(" ")[0]}?</span>
      {erro && <span className="text-xs font-medium text-danger">{erro}</span>}
      <Button variant="danger" size="md" loading={enviando} onClick={confirmar}>
        Confirmar
      </Button>
      <Button variant="ghost" size="md" onClick={() => setConfirmando(false)} disabled={enviando}>
        Cancelar
      </Button>
    </div>
  );
}
