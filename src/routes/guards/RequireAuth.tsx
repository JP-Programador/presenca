import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { TrocarSenhaObrigatoria } from "@/pages/TrocarSenhaObrigatoria";

/**
 * Protege rotas do painel administrativo que exigem apenas login válido
 * (qualquer papel). Redireciona para /admin se não houver sessão. Se o
 * usuário ainda está com a senha inicial fixa, bloqueia com a tela de
 * troca obrigatória antes de liberar qualquer conteúdo.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { usuario, carregando } = useAuth();

  if (carregando) return <LoadingScreen />;
  if (!usuario) return <Navigate to="/admin" replace />;
  if (usuario.senha_temporaria) return <TrocarSenhaObrigatoria />;

  return <>{children}</>;
}
