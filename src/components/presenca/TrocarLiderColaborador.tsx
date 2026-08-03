import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { PessoaSimples } from "@/services/coordenacaoService";
import { atualizarColaborador } from "@/services/colaboradoresService";

interface TrocarLiderColaboradorProps {
  colaboradorId: string;
  liderAtualId: string | null;
  lideres: PessoaSimples[];
  onAtualizado: () => void;
}

/** Seletor inline para reatribuir o líder direto de um colaborador já cadastrado. */
export function TrocarLiderColaborador({ colaboradorId, liderAtualId, lideres, onAtualizado }: TrocarLiderColaboradorProps) {
  const [aberto, setAberto] = useState(false);
  const [liderId, setLiderId] = useState(liderAtualId ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!aberto) {
    return (
      <Button variant="ghost" size="md" onClick={() => setAberto(true)}>
        Trocar líder
      </Button>
    );
  }

  async function salvar() {
    if (!liderId) {
      setErro("Selecione um líder.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await atualizarColaborador(colaboradorId, { lider_id: liderId });
      setAberto(false);
      onAtualizado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível trocar o líder.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={liderId}
        onChange={(e) => setLiderId(e.target.value)}
        className="h-9 rounded-md border border-ink/20 bg-white px-2 text-xs text-ink dark:border-white/20 dark:bg-[#242424] dark:text-white"
      >
        <option value="">— selecione —</option>
        {lideres.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nome}
          </option>
        ))}
      </select>
      {erro && <span className="text-xs font-medium text-danger">{erro}</span>}
      <Button variant="primary" size="md" loading={enviando} onClick={salvar}>
        Salvar
      </Button>
      <Button variant="ghost" size="md" onClick={() => setAberto(false)} disabled={enviando}>
        Cancelar
      </Button>
    </div>
  );
}
