import { hojeISO, mesAtualISO } from "@/lib/calendario";

export type ModoMapa = "dia" | "mes";

interface SeletorPeriodoMapaProps {
  modo: ModoMapa;
  onModoChange: (modo: ModoMapa) => void;
  data: string; // "YYYY-MM-DD", usado no modo "dia"
  onDataChange: (data: string) => void;
  mes: string; // "YYYY-MM", usado no modo "mes"
  onMesChange: (mes: string) => void;
}

/**
 * Alterna o mapa operacional entre "Dia" (um snapshot, como sempre foi) e
 * "Mês" (todas as marcações do mês selecionado) — os filtros de filial/
 * líder/colaborador do PresenceMap continuam valendo do mesmo jeito nos
 * dois modos, só muda o período dos pontos buscados.
 */
export function SeletorPeriodoMapa({
  modo,
  onModoChange,
  data,
  onDataChange,
  mes,
  onMesChange,
}: SeletorPeriodoMapaProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-md border border-ink/15 bg-white p-1 dark:border-white/15 dark:bg-[#242424]">
        <button
          type="button"
          onClick={() => onModoChange("dia")}
          className={[
            "rounded px-3 py-1.5 text-xs font-semibold transition-colors",
            modo === "dia" ? "bg-primary text-white" : "text-ink/60 hover:bg-surface dark:text-white/60 dark:hover:bg-white/5",
          ].join(" ")}
        >
          Dia
        </button>
        <button
          type="button"
          onClick={() => onModoChange("mes")}
          className={[
            "rounded px-3 py-1.5 text-xs font-semibold transition-colors",
            modo === "mes" ? "bg-primary text-white" : "text-ink/60 hover:bg-surface dark:text-white/60 dark:hover:bg-white/5",
          ].join(" ")}
        >
          Mês
        </button>
      </div>

      {modo === "dia" ? (
        <input
          type="date"
          value={data}
          max={hojeISO()}
          onChange={(e) => onDataChange(e.target.value)}
          className="h-10 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
        />
      ) : (
        <input
          type="month"
          value={mes}
          max={mesAtualISO()}
          onChange={(e) => onMesChange(e.target.value)}
          className="h-10 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
        />
      )}
    </div>
  );
}
