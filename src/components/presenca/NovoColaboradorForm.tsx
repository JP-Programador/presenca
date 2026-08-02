import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import type { PessoaSimples } from "@/services/coordenacaoService";
import { criarColaborador } from "@/services/colaboradoresService";
import type { Filial } from "@/types/domain";

interface NovoColaboradorFormProps {
  /** Se o criador já É o líder direto (perfil=gestor), o campo fica travado nele mesmo. */
  liderFixo?: PessoaSimples;
  /** Lista de líderes pra escolher, quando quem cria é coordenador/admin. */
  lideres: PessoaSimples[];
  filiais: Filial[];
  onCriado: () => void;
}

export function NovoColaboradorForm({ liderFixo, lideres, filiais, onCriado }: NovoColaboradorFormProps) {
  const [nome, setNome] = useState("");
  const [matricula, setMatricula] = useState("");
  const [cargo, setCargo] = useState("");
  const [liderId, setLiderId] = useState(liderFixo?.id ?? "");
  const [filialId, setFilialId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!liderId) {
      setErro("Selecione o líder direto.");
      return;
    }
    if (!filialId) {
      setErro("Selecione a filial.");
      return;
    }
    setEnviando(true);
    setErro(null);
    setSucesso(false);
    try {
      await criarColaborador({ nome, matricula, cargo, liderId, filialId });
      setSucesso(true);
      setNome("");
      setMatricula("");
      setCargo("");
      if (!liderFixo) setLiderId("");
      setFilialId("");
      onCriado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível criar o colaborador.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {erro && <Alert variant="danger">{erro}</Alert>}
      {sucesso && <Alert variant="success">Colaborador cadastrado.</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="nome-colaborador" label="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <Input
          id="matricula-colaborador"
          label="Matrícula"
          value={matricula}
          onChange={(e) => setMatricula(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="cargo-colaborador" label="Cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} required />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink dark:text-white">Filial</label>
          <select
            value={filialId}
            onChange={(e) => setFilialId(e.target.value)}
            className="h-11 rounded-md border border-ink/20 bg-white px-3 text-sm text-ink dark:border-white/20 dark:bg-[#242424] dark:text-white"
          >
            <option value="">— selecione —</option>
            {filiais.map((f) => (
              <option key={f.id} value={f.id}>
                {f.codigo} · {f.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink dark:text-white">Líder direto</label>
        {liderFixo ? (
          <p className="flex h-11 items-center rounded-md border border-ink/15 bg-surface px-3 text-sm text-ink/70 dark:border-white/15 dark:bg-white/5 dark:text-white/70">
            {liderFixo.nome}
          </p>
        ) : (
          <select
            value={liderId}
            onChange={(e) => setLiderId(e.target.value)}
            className="h-11 rounded-md border border-ink/20 bg-white px-3 text-sm text-ink dark:border-white/20 dark:bg-[#242424] dark:text-white"
          >
            <option value="">— selecione —</option>
            {lideres.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        )}
      </div>

      <Button type="submit" loading={enviando} className="self-start">
        Cadastrar colaborador
      </Button>
    </form>
  );
}
