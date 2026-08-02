import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import type { Filial, PerfilAcesso } from "@/types/domain";
import { criarUsuario } from "@/services/coordenacaoService";

const PAPEIS: { valor: PerfilAcesso; label: string }[] = [
  { valor: "colaborador", label: "Colaborador" },
  { valor: "gestor", label: "Gestor (líder de filial)" },
  { valor: "coordenador", label: "Coordenador" },
  { valor: "auditor", label: "Auditor (somente leitura)" },
  { valor: "admin", label: "Administrador" },
];

export function NovoUsuarioForm({ filiais, onCriado }: { filiais: Filial[]; onCriado: () => void }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState<PerfilAcesso>("colaborador");
  const [filialId, setFilialId] = useState("");
  const [filiaisGerenciadas, setFiliaisGerenciadas] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  function alternarFilialGerenciada(id: string) {
    setFiliaisGerenciadas((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    setSucesso(false);
    try {
      await criarUsuario({
        nome,
        email,
        perfil,
        filial_id: filialId || null,
        filiais_gerenciadas: perfil === "gestor" ? filiaisGerenciadas : undefined,
      });
      setSucesso(true);
      setNome("");
      setEmail("");
      setPerfil("colaborador");
      setFilialId("");
      setFiliaisGerenciadas([]);
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
      {sucesso && <Alert variant="success">Convite enviado. O usuário define a senha no primeiro acesso.</Alert>}

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
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Papel de acesso</label>
          <select
            value={perfil}
            onChange={(e) => setPerfil(e.target.value as PerfilAcesso)}
            className="h-11 rounded-md border border-ink/20 bg-white px-3 text-sm text-ink"
          >
            {PAPEIS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Filial de origem</label>
          <select
            value={filialId}
            onChange={(e) => setFilialId(e.target.value)}
            className="h-11 rounded-md border border-ink/20 bg-white px-3 text-sm text-ink"
          >
            <option value="">Nenhuma / todas (admin, coordenador)</option>
            {filiais.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {perfil === "gestor" && (
        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink">Filiais que este gestor vai gerenciar</span>
          <div className="flex flex-wrap gap-2">
            {filiais.map((f) => (
              <button
                type="button"
                key={f.id}
                onClick={() => alternarFilialGerenciada(f.id)}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  filiaisGerenciadas.includes(f.id)
                    ? "border-primary bg-[#FDE9DD] text-primary-dark"
                    : "border-ink/15 bg-white text-ink/60",
                ].join(" ")}
              >
                {f.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      <Button type="submit" loading={enviando} className="self-start">
        Enviar convite
      </Button>
    </form>
  );
}
