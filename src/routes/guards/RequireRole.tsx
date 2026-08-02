import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import type { PerfilAcesso } from "@/types/domain";

interface RequireRoleProps {
  roles: PerfilAcesso[];
  children: ReactNode;
  /** Para onde mandar um usuário autenticado mas sem o papel exigido. Padrão: /lider. */
  fallback?: string;
}

/**
 * Protege rotas restritas a determinados papéis (ex.: coordenador/admin em
 * /coordenador, /auditoria, /usuarios). Sem sessão -> /admin.
 * Com sessão mas papel fora da lista -> `fallback` (evita tela em branco
 * e evita expor a existência da rota a quem não deveria acessá-la).
 */
export function RequireRole({ roles, children, fallback = "/lider" }: RequireRoleProps) {
  const { usuario, carregando } = useAuth();

  if (carregando) return <LoadingScreen />;
  if (!usuario) return <Navigate to="/admin" replace />;
  if (!roles.includes(usuario.perfil)) return <Navigate to={fallback} replace />;

  return <>{children}</>;
}
