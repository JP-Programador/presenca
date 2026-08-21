import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface BrandHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

/** Faixa de topo com identidade TLP, usada em todas as telas do sistema. */
export function BrandHeader({ title, subtitle, right }: BrandHeaderProps) {
  return (
    <header className="border-b border-ink/10 bg-white dark:border-white/10 dark:bg-[#1F1F1F]">
      <div className="h-1 w-full bg-gradient-to-r from-primary via-primary-dark to-primary" aria-hidden="true" />
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/logo-tlp.avif" alt="TLP" className="h-9 w-9 shrink-0 rounded-md object-contain" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">TLP · Presença Operacional</p>
            <h1 className="truncate text-lg font-semibold text-ink dark:text-white sm:text-xl">{title}</h1>
            {subtitle && <p className="mt-0.5 truncate text-sm text-ink/60 dark:text-white/60">{subtitle}</p>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {right}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
