interface SkeletonProps {
  className?: string;
}

/** Bloco de carregamento (Módulo 14) — usar no lugar do spinner quando o layout final já é conhecido (listas, cards). */
export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={["skeleton rounded-md bg-ink/10 dark:bg-white/10", className].join(" ")} aria-hidden="true" />;
}

/** Skeleton de um card de linha (nome + subtítulo + badge), no formato usado por PendenciasPainel/PendenteCard. */
export function SkeletonCardLinha() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-white p-4 dark:border-white/10 dark:bg-[#242424]">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  );
}

/** Lista de skeletons de linha, para telas que carregam N itens (Módulo 8, justificativas, etc.). */
export function SkeletonLista({ linhas = 4 }: { linhas?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: linhas }).map((_, i) => (
        <SkeletonCardLinha key={i} />
      ))}
    </div>
  );
}
