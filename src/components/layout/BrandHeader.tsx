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
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">TLP · Presença Operacional</p>
          <h1 className="text-lg font-semibold text-ink dark:text-white sm:text-xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-ink/60 dark:text-white/60">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {right}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
