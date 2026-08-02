import { useMemo } from "react";
import type { AuditLogEntry } from "@/types/domain";

interface AuditTimelineProps {
  logs: AuditLogEntry[];
  acaoLabel: Record<string, string>;
  onSelecionar: (log: AuditLogEntry) => void;
}

function agruparPorDia(logs: AuditLogEntry[]) {
  const mapa = new Map<string, AuditLogEntry[]>();
  for (const log of logs) {
    const dia = new Date(log.created_at).toLocaleDateString("pt-BR");
    if (!mapa.has(dia)) mapa.set(dia, []);
    mapa.get(dia)!.push(log);
  }
  return Array.from(mapa.entries());
}

/** Linha do tempo de eventos de auditoria, agrupada por dia (Módulo 11). */
export function AuditTimeline({ logs, acaoLabel, onSelecionar }: AuditTimelineProps) {
  const grupos = useMemo(() => agruparPorDia(logs), [logs]);

  if (logs.length === 0) {
    return <p className="py-10 text-center text-sm text-ink/50">Nenhum evento encontrado.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {grupos.map(([dia, eventos]) => (
        <div key={dia}>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/40">{dia}</p>
          <ol className="relative flex flex-col gap-3 border-l-2 border-ink/10 pl-4">
            {eventos.map((log) => (
              <li key={log.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                <button
                  onClick={() => onSelecionar(log)}
                  className="w-full rounded-md text-left transition-colors hover:bg-surface"
                >
                  <div className="flex items-start justify-between gap-4 py-1">
                    <div>
                      <p className="text-sm font-medium text-ink">{acaoLabel[log.acao] ?? log.acao}</p>
                      <p className="text-xs text-ink/50">{log.entidade}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium text-ink/70">{log.ator_nome ?? "Sistema"}</p>
                      <p className="text-xs text-ink/40">
                        {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
