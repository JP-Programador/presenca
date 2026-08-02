import type { FaixaSla } from "@/types/status";

const ESTILOS: Record<FaixaSla, string> = {
  verde: "bg-[#E7F3E8] text-[#2E7D32]",
  amarelo: "bg-[#FFF3DB] text-[#8A6200]",
  vermelho: "bg-[#FBE7E7] text-danger",
};

function faixaPorMinutos(minutos: number): FaixaSla {
  if (minutos <= 15) return "verde";
  if (minutos <= 30) return "amarelo";
  return "vermelho";
}

interface SlaBadgeProps {
  minutos: number;
  faixa?: FaixaSla;
}

/** Badge de SLA de aprovação (Módulo 10): verde <=15min, amarelo 15-30min, vermelho >30min. */
export function SlaBadge({ minutos, faixa }: SlaBadgeProps) {
  const f = faixa ?? faixaPorMinutos(minutos);
  return (
    <span className={["inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", ESTILOS[f]].join(" ")}>
      {Math.round(minutos)} min
    </span>
  );
}
