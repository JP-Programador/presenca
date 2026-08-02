import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

/**
 * Protege rotas do painel administrativo que exigem apenas login válido
 * (qualquer papel). Redireciona para /admin se não houver sessão.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { usuario, carregando } = useAuth();

  if (carregando) return <LoadingScreen />;
  if (!usuario) return <Navigate to="/admin" replace />;

  return <>{children}</>;
}
