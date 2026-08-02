import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import type { PerfilAcesso } from "@/types/domain";

const VISAO_GLOBAL: PerfilAcesso[] = ["admin", "auditor", "coordenador"];
const GESTAO_USUARIOS: PerfilAcesso[] = ["admin", "coordenador"];
const GESTAO_COLABORADORES: PerfilAcesso[] = ["admin", "coordenador", "gestor"];

/**
 * Links de navegação entre os painéis administrativos + botão sair,
 * mostrados conforme a hierarquia: coordenação/auditoria para quem tem
 * visão global (admin, auditor, coordenador); usuários para admin/coordenador;
 * colaboradores para gestor/coordenador/admin.
 */
export function NavPaineis({
  perfil,
  atual,
  onSair,
}: {
  perfil: PerfilAcesso;
  atual: "lider" | "coordenador" | "auditoria" | "usuarios" | "colaboradores";
  onSair: () => void;
}) {
  const temVisaoGlobal = VISAO_GLOBAL.includes(perfil);

  return (
    <div className="flex items-center gap-2">
      {atual !== "coordenador" && temVisaoGlobal && (
        <Link to="/coordenador" className="text-sm font-semibold text-primary hover:underline">
          Coordenação
        </Link>
      )}
      {atual !== "auditoria" && temVisaoGlobal && (
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
