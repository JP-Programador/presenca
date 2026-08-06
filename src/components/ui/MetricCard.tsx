export function MetricCard({
  label,
  valor,
  subtitulo,
  tooltip,
  destaque,
}: {
  label: string;
  valor: string;
  /** Linha pequena abaixo do valor (ex.: "8/10 presentes"). Prefira isso a espremer tudo no label. */
  subtitulo?: string;
  /** Texto extra só no hover (desktop) — usado pra detalhar o que compõe a métrica sem poluir o card. */
  tooltip?: string;
  destaque?: "primary" | "danger" | "warning" | "neutral";
}) {
  const cor = {
    primary: "text-primary",
    danger: "text-danger",
    warning: "text-[#8A6200] dark:text-[#E0B84D]",
    neutral: "text-ink dark:text-white",
  }[destaque ?? "neutral"];

  return (
    <div
      className="rounded-lg border border-ink/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#242424]"
      title={tooltip}
    >
      <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink/50 dark:text-white/50">{label}</p>
      <p className={["mt-1 text-2xl font-bold", cor].join(" ")}>{valor}</p>
      {subtitulo && <p className="mt-0.5 truncate text-xs text-ink/50 dark:text-white/50">{subtitulo}</p>}
    </div>
  );
}
