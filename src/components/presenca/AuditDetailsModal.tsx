import type { AuditLogEntry } from "@/types/domain";

interface AuditDetailsModalProps {
  log: AuditLogEntry;
  acaoLabel: string;
  onFechar: () => void;
}

/** Modal com o detalhe completo de um evento de auditoria (Módulo 11). */
export function AuditDetailsModal({ log, acaoLabel, onFechar }: AuditDetailsModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onFechar}
    >
      <div
        className="flex w-full max-w-lg flex-col gap-3 rounded-t-lg bg-white p-5 shadow-lg sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-base font-semibold text-ink">{acaoLabel}</h2>
          <p className="text-xs text-ink/50">
            {new Date(log.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" })}
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-ink/40">Responsável</dt>
          <dd className="col-span-2 text-ink">{log.ator_nome ?? "Sistema"}</dd>

          <dt className="text-ink/40">Entidade</dt>
          <dd className="col-span-2 text-ink">{log.entidade}</dd>

          <dt className="text-ink/40">ID do registro</dt>
          <dd className="col-span-2 break-all font-mono text-ink/70">{log.entidade_id ?? "—"}</dd>
        </dl>

        {log.detalhes && (
          <div>
            <p className="mb-1 text-xs font-semibold text-ink/60">Detalhes</p>
            <pre className="overflow-x-auto rounded-md bg-surface p-3 text-xs text-ink/70">
              {JSON.stringify(log.detalhes, null, 2)}
            </pre>
          </div>
        )}

        <button
          onClick={onFechar}
          className="mt-1 h-10 rounded-md border border-ink/15 text-sm font-semibold text-ink hover:bg-surface"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
