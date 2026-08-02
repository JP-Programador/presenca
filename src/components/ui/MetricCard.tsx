export function MetricCard({
  label,
  valor,
  destaque,
}: {
  label: string;
  valor: string;
  destaque?: "primary" | "danger" | "warning" | "neutral";
}) {
  const cor = {
    primary: "text-primary",
    danger: "text-danger",
    warning: "text-[#8A6200] dark:text-[#E0B84D]",
    neutral: "text-ink dark:text-white",
  }[destaque ?? "neutral"];

  return (
    <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#242424]">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/50 dark:text-white/50">{label}</p>
      <p className={["mt-1 text-2xl font-bold", cor].join(" ")}>{valor}</p>
    </div>
  );
}
