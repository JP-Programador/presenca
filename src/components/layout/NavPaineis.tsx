import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import type { PerfilAcesso } from "@/types/domain";

const VISAO_GLOBAL: PerfilAcesso[] = ["admin", "auditor", "coordenador"];
const AUDITORIA: PerfilAcesso[] = ["admin", "auditor"];
const GESTAO_USUARIOS: PerfilAcesso[] = ["admin", "coordenador"];
const GESTAO_COLABORADORES: PerfilAcesso[] = ["admin", "coordenador", "gestor"];
const DASHBOARD_PRESENCA: PerfilAcesso[] = ["admin", "auditor", "coordenador", "gestor"];

/**
 * Links de navegação entre os painéis administrativos + botão sair,
 * mostrados conforme a hierarquia: coordenação para quem tem visão global
 * (admin, auditor, coordenador); auditoria exclusiva de admin/auditor;
 * usuários para admin/coordenador; colaboradores para gestor/coordenador/admin;
 * dashboard de presença (gráficos/comparativo) para todo mundo acima de
 * colaborador — escopado pela própria hierarquia via RLS.
 */
export function NavPaineis({
  perfil,
  atual,
  onSair,
}: {
  perfil: PerfilAcesso;
  atual: "lider" | "coordenador" | "auditoria" | "usuarios" | "colaboradores" | "dashboard-presenca";
  onSair: () => void;
}) {
  const temVisaoGlobal = VISAO_GLOBAL.includes(perfil);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {atual !== "coordenador" && temVisaoGlobal && (
        <Link to="/coordenador" className="text-sm font-semibold text-primary hover:underline">
          Coordenação
        </Link>
      )}
      {atual !== "dashboard-presenca" && DASHBOARD_PRESENCA.includes(perfil) && (
        <Link to="/dashboard-presenca" className="text-sm font-semibold text-primary hover:underline">
          Dashboard
        </Link>
      )}
      {atual !== "auditoria" && AUDITORIA.includes(perfil) && (
        <Link to="/auditoria" className="text-sm font-semibold text-primary hover:underline">
          Auditoria
        </Link>
      )}
      {atual !== "colaboradores" && GESTAO_COLABORADORES.includes(perfil) && (
        <Link to="/colaboradores" className="text-sm font-semibold text-primary hover:underline">
          Colaboradores
        </Link>
      )}
      {atual !== "usuarios" && GESTAO_USUARIOS.includes(perfil) && (
        <Link to="/usuarios" className="text-sm font-semibold text-primary hover:underline">
          Usuários
        </Link>
      )}
      <Button variant="ghost" size="md" onClick={onSair}>
        Sair
      </Button>
    </div>
  );
}
