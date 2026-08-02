import { FormEvent, useState } from "react";
import { BrandHeader } from "@/components/layout/BrandHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { useAuth } from "@/providers/AuthProvider";
import { definirNovaSenha } from "@/services/authService";

/**
 * Bloqueia o acesso ao resto do sistema até o usuário trocar a senha
 * inicial fixa ("Mudar@123", ver Edge Function admin-criar-usuario) por
 * uma própria. Renderizada pelos guards de rota (RequireAuth/RequireRole)
 * no lugar da tela pedida, enquanto perfis.senha_temporaria = true.
 */
export function TrocarSenhaObrigatoria() {
  const { usuario, recarregarUsuario } = useAuth();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const senhaValida = novaSenha.length >= 8 && novaSenha !== "Mudar@123";
  const podeEnviar = senhaValida && novaSenha === confirmacao;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!podeEnviar || !usuario) return;
    setEnviando(true);
    setErro(null);
    const { error } = await definirNovaSenha(novaSenha, usuario.id);
    if (error) {
      setErro("Não foi possível trocar a senha. Tente novamente.");
      setEnviando(false);
      return;
    }
    await recarregarUsuario();
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-[#1A1A1A]">
      <BrandHeader title="Defina sua senha" subtitle="Acesso obrigatório antes de continuar" />
      <main className="mx-auto max-w-md px-4 py-10">
        <Card>
          <CardBody className="flex flex-col gap-4">
            <p className="text-sm text-ink/60 dark:text-white/60">
              Sua conta foi criada com uma senha temporária. Defina uma senha própria (mínimo 8
              caracteres) para continuar.
            </p>

            {erro && <Alert variant="danger">{erro}</Alert>}

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Input
                id="nova-senha"
                type="password"
                label="Nova senha"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                autoComplete="new-password"
                required
              />
              <Input
                id="confirmacao-senha"
                type="password"
                label="Confirme a nova senha"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                autoComplete="new-password"
                required
              />
              {novaSenha.length > 0 && novaSenha.length < 8 && (
                <p className="text-xs text-danger">A senha precisa ter pelo menos 8 caracteres.</p>
              )}
              {confirmacao.length > 0 && novaSenha !== confirmacao && (
                <p className="text-xs text-danger">As senhas não conferem.</p>
              )}

              <Button type="submit" size="lg" fullWidth disabled={!podeEnviar} loading={enviando}>
                Salvar e continuar
              </Button>
            </form>
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
