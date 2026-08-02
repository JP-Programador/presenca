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
    warning: "text-[#8A6200]",
    neutral: "text-ink",
  }[destaque ?? "neutral"];

  return (
    <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</p>
      <p className={["mt-1 text-2xl font-bold", cor].join(" ")}>{valor}</p>
    </div>
  );
}
