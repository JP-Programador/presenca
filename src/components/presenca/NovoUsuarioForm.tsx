import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import type { Filial, PerfilAcesso } from "@/types/domain";
import type { PessoaSimples } from "@/services/coordenacaoService";
import { criarUsuario } from "@/services/coordenacaoService";

const PAPEIS: { valor: PerfilAcesso; label: string }[] = [
  { valor: "colaborador", label: "Colaborador" },
  { valor: "gestor", label: "Gestor (líder de filial)" },
  { valor: "coordenador", label: "Coordenador" },
  { valor: "auditor", label: "Auditor (somente leitura)" },
  { valor: "admin", label: "Administrador" },
];

interface NovoUsuarioFormProps {
  filiais: Filial[];
  coordenadores: PessoaSimples[];
  /** Coordenador só pode criar líderes (gestor) — o papel fica travado nesse caso. */
  perfilCriador: PerfilAcesso;
  onCriado: () => void;
}

export function NovoUsuarioForm({ filiais, coordenadores, perfilCriador, onCriado }: NovoUsuarioFormProps) {
  const criadorEhCoordenador = perfilCriador === "coordenador";

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState<PerfilAcesso>(criadorEhCoordenador ? "gestor" : "colaborador");
  const [filialId, setFilialId] = useState("");
  const [coordenadorId, setCoordenadorId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    setSenhaGerada(null);
    try {
      const resultado = await criarUsuario({
        nome,
        email,
        perfil,
        filial_id: perfil === "coordenador" || perfil === "gestor" ? null : filialId || null,
        coordenador_id: perfil === "gestor" && !criadorEhCoordenador ? coordenadorId || null : undefined,
      });
      setSenhaGerada(resultado.senha_inicial);
      setNome("");
      setEmail("");
      setPerfil(criadorEhCoordenador ? "gestor" : "colaborador");
      setFilialId("");
      setCoordenadorId("");
      onCriado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível criar o usuário.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {erro && <Alert variant="danger">{erro}</Alert>}
      {senhaGerada && (
        <Alert variant="success" title="Usuário criado">
          Senha inicial: <strong>{senhaGerada}</strong> — passe para a pessoa por fora (WhatsApp, verbal etc.)
          agora, ela não será mostrada novamente. O sistema vai obrigar a troca dessa senha no primeiro acesso.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="nome" label="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <Input
          id="email"
          type="email"
          label="E-mail corporativo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {!criadorEhCoordenador && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink dark:text-white">Papel de acesso</label>
            <select
              value={perfil}
              onChange={(e) => setPerfil(e.target.value as PerfilAcesso)}
              className="h-11 rounded-md border border-ink/20 bg-white px-3 text-sm text-ink dark:border-white/20 dark:bg-[#242424] dark:text-white"
            >
              {PAPEIS.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {criadorEhCoordenador && (
          <p className="flex items-end pb-2.5 text-sm text-ink/60 dark:text-white/60">
            Como coordenador, você só pode criar <strong className="mx-1">líderes (gestor)</strong>, vinculados
            automaticamente a você.
          </p>
        )}

        {perfil !== "coordenador" && perfil !== "gestor" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink dark:text-white">Filial de origem</label>
            <select
              value={filialId}
              onChange={(e) => setFilialId(e.target.value)}
              className="h-11 rounded-md border border-ink/20 bg-white px-3 text-sm text-ink dark:border-white/20 dark:bg-[#242424] dark:text-white"
            >
              <option value="">Nenhuma / todas (admin, coordenador)</option>
              {filiais.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {perfil === "gestor" && !criadorEhCoordenador && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink dark:text-white">Coordenador direto</label>
          <select
            value={coordenadorId}
            onChange={(e) => setCoordenadorId(e.target.value)}
            className="h-11 rounded-md border border-ink/20 bg-white px-3 text-sm text-ink dark:border-white/20 dark:bg-[#242424] dark:text-white"
          >
            <option value="">— selecione —</option>
            {coordenadores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <Button type="submit" loading={enviando} className="self-start">
        Criar usuário
      </Button>
    </form>
  );
}
