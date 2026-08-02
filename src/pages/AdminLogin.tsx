import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { BrandHeader } from "@/components/layout/BrandHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useAuth } from "@/providers/AuthProvider";

export function AdminLogin() {
  const { usuario, carregando, entrar } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!carregando && usuario) {
    const temVisaoGlobal = usuario.perfil === "admin" || usuario.perfil === "auditor" || usuario.perfil === "coordenador";
    return <Navigate to={temVisaoGlobal ? "/coordenador" : "/lider"} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const { error } = await entrar(email, senha);
    setEnviando(false);
    if (error) {
      setErro("E-mail ou senha inválidos.");
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <BrandHeader title="Acesso administrativo" subtitle="Painel do líder / gestão" />

      <main className="mx-auto flex max-w-sm flex-col justify-center px-4 py-16">
        <Card>
          <CardBody className="flex flex-col gap-5">
            <div>
              <h2 className="text-base font-semibold text-ink">Entrar</h2>
              <p className="mt-1 text-sm text-ink/60">
                Acesso restrito a líderes e administradores da TLP.
              </p>
            </div>

            {erro && <Alert variant="danger">{erro}</Alert>}

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Input
                id="email"
                type="email"
                label="E-mail corporativo"
                placeholder="nome@tlp.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
              <Input
                id="senha"
                type="password"
                label="Senha"
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
                required
              />
              <Button type="submit" size="lg" fullWidth loading={enviando}>
                Entrar
              </Button>
            </form>
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
