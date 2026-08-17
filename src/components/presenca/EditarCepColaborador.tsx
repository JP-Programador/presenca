import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { atualizarCepColaborador } from "@/services/colaboradoresService";

interface EditarCepColaboradorProps {
  colaboradorId: string;
  cepAtual: string | null;
  onAtualizado: () => void;
}

/** Campo inline pra cadastrar/trocar o CEP residencial de um colaborador já existente — base do alerta de check-in perto de casa. */
export function EditarCepColaborador({ colaboradorId, cepAtual, onAtualizado }: EditarCepColaboradorProps) {
  const [aberto, setAberto] = useState(false);
  const [cep, setCep] = useState(cepAtual ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!aberto) {
    return (
      <Button variant="ghost" size="md" onClick={() => setAberto(true)}>
        {cepAtual ? "Trocar CEP" : "Cadastrar CEP"}
      </Button>
    );
  }

  async function salvar() {
    if (!cep.trim()) {
      setErro("Informe um CEP.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const coordenada = await atualizarCepColaborador(colaboradorId, cep.trim());
      if (!coordenada) {
        setErro("CEP salvo, mas não foi possível localizar a coordenada — tente conferir o CEP.");
        setEnviando(false);
        return;
      }
      setAberto(false);
      onAtualizado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar o CEP.");
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={cep}
        onChange={(e) => setCep(e.target.value)}
        placeholder="00000-000"
        className="h-9 w-28 rounded-md border border-ink/20 bg-white px-2 text-xs text-ink dark:border-white/20 dark:bg-[#242424] dark:text-white"
      />
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
