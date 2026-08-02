import type { StatusPresenca, StatusJustificativa } from "@/types/domain";

type BadgeStatus = StatusPresenca | StatusJustificativa;

const labels: Record<BadgeStatus, string> = {
  presente: "Presente",
  atrasado: "Atrasado",
  ausente: "Ausente",
  justificado: "Justificado",
  pendente_aprovacao: "Pendente de aprovação",
  pendente: "Pendente",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};

const classes: Record<BadgeStatus, string> = {
  presente: "bg-[#E7F3E8] text-[#2E7D32]",
  atrasado: "bg-[#FFF3DB] text-[#8A6200]",
  ausente: "bg-[#FBE7E7] text-danger",
  justificado: "bg-[#FDE9DD] text-primary-dark",
  pendente_aprovacao: "bg-[#FDE9DD] text-primary-dark",
  pendente: "bg-[#FFF3DB] text-[#8A6200]",
  aprovada: "bg-[#E7F3E8] text-[#2E7D32]",
  rejeitada: "bg-[#FBE7E7] text-danger",
};

export function StatusBadge({ status }: { status: BadgeStatus }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        classes[status],
      ].join(" ")}
    >
      {labels[status]}
    </span>
  );
}
