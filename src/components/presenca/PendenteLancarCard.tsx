import { useMemo } from "react";
import { apos9hEmDiaUtil } from "@/lib/calendario";
import type { StatusDiaRegistro } from "@/types/status";

interface PendenteLancarCardProps {
  itens: StatusDiaRegistro[];
}

/**
 * Card "Pendente lançar presença": quem ainda está em FALTA/FOLGA hoje sem
 * nenhuma decisão humana em cima (decidido_por nulo) — ou seja, ainda é o
 * valor padrão criado pelo sistema, ninguém olhou pra isso ainda. Assim que
 * o líder ou coordenador lança qualquer status manualmente (inclusive
 * confirmando "sim, é falta mesmo"), decidido_por deixa de ser nulo e a
 * pessoa sai da lista — o status programado do dia continua valendo, isso
 * é só sobre já ter sido revisado ou não. Às 9h da manhã em dia útil isso
 * passa a ser destacado em vermelho como alerta.
 */
export function PendenteLancarCard({ itens }: PendenteLancarCardProps) {
  const apos9h = useMemo(apos9hEmDiaUtil, []);

  const pendentes = useMemo(
    () =>
      itens
        .filter((i) => (i.status === "FALTA" || i.status === "FOLGA") && !i.decidido_por)
        .sort((a, b) => (a.colaborador_nome ?? "").localeCompare(b.colaborador_nome ?? "")),
    [itens]
  );

  return (
    <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#242424]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/50 dark:text-white/50">
          Pendente lançar presença
        </p>
        <span
          className={[
            "rounded-full px-2 py-0.5 text-xs font-bold",
            apos9h && pendentes.length > 0
              ? "bg-[#FBE7E7] text-danger"
              : "bg-surface text-ink/60 dark:bg-white/10 dark:text-white/60",
          ].join(" ")}
        >
          {pendentes.length}
        </span>
      </div>

      {!apos9h && pendentes.length > 0 && (
        <p className="mt-1 text-[11px] text-ink/40 dark:text-white/40">Ainda dentro do prazo (até 9h).</p>
      )}

      {pendentes.length === 0 ? (
        <p className="mt-2 text-sm text-ink/50 dark:text-white/50">Todo mundo já lançou.</p>
      ) : (
        <ul className="mt-2 max-h-40 overflow-y-auto text-sm">
          {pendentes.map((p) => (
            <li
              key={p.id}
              className={[
                "truncate py-1",
                apos9h ? "font-medium text-danger" : "text-ink/70 dark:text-white/70",
              ].join(" ")}
            >
              {p.colaborador_nome ?? "Colaborador"}
              {p.filial_nome && <span className="text-ink/40 dark:text-white/40"> · {p.filial_nome}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
