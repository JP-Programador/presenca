interface StatusChipProps {
  label: string;
  ok: boolean;
  pending?: boolean;
  icon: React.ReactNode;
}

/** Chip usado na tela do técnico para mostrar se câmera/GPS já foram capturados. */
export function StatusChip({ label, ok, pending, icon }: StatusChipProps) {
  const state = pending ? "pending" : ok ? "ok" : "missing";

  const styles = {
    ok: "border-[#2E7D32]/30 bg-[#E7F3E8] text-[#2E7D32]",
    pending: "border-warning/30 bg-[#FFF3DB] text-[#8A6200]",
    missing: "border-ink/15 bg-white text-ink/50",
  }[state];

  return (
    <div className={["flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold", styles].join(" ")}>
      <span
        className={[
          "h-2 w-2 shrink-0 rounded-full",
          state === "ok" ? "bg-[#2E7D32]" : state === "pending" ? "animate-pulse bg-warning" : "bg-ink/20",
        ].join(" ")}
        aria-hidden="true"
      />
      {icon}
      <span>{label}</span>
    </div>
  );
}
