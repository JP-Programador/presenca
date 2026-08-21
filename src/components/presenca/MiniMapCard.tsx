import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PresenceMap } from "@/components/presenca/PresenceMap";
import { STATUS_DIA_LABEL, type PontoMapaOperacional, type StatusDia } from "@/types/status";

interface MiniMapCardProps {
  titulo: string;
  pontos: PontoMapaOperacional[];
  carregando?: boolean;
  /** Filtra os pontos exibidos no mapa por nome (ex.: sincronizado com a busca do painel de pendências). */
  filtroNome?: string;
  /** Marcação em destaque (ex.: clicada numa tabela abaixo) — repassado direto pro PresenceMap. */
  pontoFoco?: { latitude: number; longitude: number; label?: string } | null;
}

const ORDEM_RESUMO: StatusDia[] = ["PRESENTE", "PENDENTE", "FALTA", "ATESTADO", "FOLGA", "OUTROS"];

/** Card compacto com o mapa operacional + resumo por status — usado em dashboards menores (líder). */
export function MiniMapCard({ titulo, pontos, carregando, filtroNome, pontoFoco }: MiniMapCardProps) {
  const termo = filtroNome?.trim().toLowerCase();
  const pontosFiltrados = termo
    ? pontos.filter((p) => p.colaborador_nome?.toLowerCase().includes(termo))
    : pontos;

  const resumo = ORDEM_RESUMO.map((status) => ({
    status,
    total: pontosFiltrados.filter((p) => p.status === status).length,
  })).filter((r) => r.total > 0);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-ink">{titulo}</h2>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink/50">
          {resumo.map((r) => (
            <span key={r.status}>
              {STATUS_DIA_LABEL[r.status]}: <strong className="text-ink/70">{r.total}</strong>
            </span>
          ))}
        </div>
      </CardHeader>
      <CardBody>
        {carregando ? (
          <div className="flex h-[200px] items-center justify-center rounded-lg border border-ink/10 bg-surface">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <PresenceMap pontos={pontosFiltrados} somenteExibicao altura={200} pontoFoco={pontoFoco} />
        )}
      </CardBody>
    </Card>
  );
}
