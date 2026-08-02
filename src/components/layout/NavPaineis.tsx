import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import type { PerfilAcesso } from "@/types/domain";

const VISAO_GLOBAL: PerfilAcesso[] = ["admin", "auditor", "coordenador"];

/**
 * Links de navegação entre os painéis administrativos + botão sair,
 * mostrados conforme a hierarquia: coordenação/auditoria para quem tem
 * visão global (admin, auditor, coordenador); usuários só para admin.
 */
export function NavPaineis({
  perfil,
  atual,
  onSair,
}: {
  perfil: PerfilAcesso;
  atual: "lider" | "coordenador" | "auditoria" | "usuarios";
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
      {atual !== "usuarios" && perfil === "admin" && (
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
