import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { atualizarColaborador, excluirColaboradorPermanentemente } from "@/services/colaboradoresService";

interface ExcluirColaboradorButtonProps {
  colaboradorId: string;
  nome: string;
  ativo: boolean;
  /** Só admin/gerente vê a opção de excluir permanentemente (a de reativar/inativar continua pra todo mundo). */
  podeExcluirPermanentemente?: boolean;
  onAtualizado: () => void;
}

/** Inativa (soft-delete) um colaborador — preserva o histórico de presença/faltas já registrado. */
export function ExcluirColaboradorButton({
  colaboradorId,
  nome,
  ativo,
  podeExcluirPermanentemente,
  onAtualizado,
}: ExcluirColaboradorButtonProps) {
  const [confirmando, setConfirmando] = useState(false);
  const [confirmandoExclusaoPermanente, setConfirmandoExclusaoPermanente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!ativo) {
    if (confirmandoExclusaoPermanente) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-danger">
            Excluir {nome.split(" ")[0]} PRA SEMPRE — apaga todo o histórico de presença dele. Não dá pra desfazer.
          </span>
          {erro && <span className="text-xs font-medium text-danger">{erro}</span>}
          <Button
            variant="danger"
            size="md"
            loading={enviando}
            onClick={async () => {
              setEnviando(true);
              setErro(null);
              try {
                await excluirColaboradorPermanentemente(colaboradorId);
                onAtualizado();
              } catch (err) {
                setErro(err instanceof Error ? err.message : "Não foi possível excluir permanentemente.");
                setEnviando(false);
              }
            }}
          >
            Excluir pra sempre
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={() => setConfirmandoExclusaoPermanente(false)}
            disabled={enviando}
          >
            Cancelar
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
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
        {podeExcluirPermanentemente && (
          <Button variant="danger" size="md" onClick={() => setConfirmandoExclusaoPermanente(true)}>
            Excluir permanentemente
          </Button>
        )}
      </div>
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
