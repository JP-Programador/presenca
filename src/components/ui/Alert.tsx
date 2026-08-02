type AlertVariant = "info" | "success" | "danger" | "warning";

const styles: Record<AlertVariant, string> = {
  info: "bg-[#FDE9DD] text-primary-dark border-primary/20",
  success: "bg-[#E7F3E8] text-[#2E7D32] border-[#2E7D32]/20",
  danger: "bg-[#FBE7E7] text-danger border-danger/20",
  warning: "bg-[#FFF3DB] text-[#8A6200] border-warning/30",
};

export function Alert({
  variant = "info",
  title,
  children,
}: {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={["rounded-md border px-4 py-3 text-sm", styles[variant]].join(" ")} role="status">
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      <p>{children}</p>
    </div>
  );
}
