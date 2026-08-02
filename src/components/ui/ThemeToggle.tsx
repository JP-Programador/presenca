import { useTheme } from "@/providers/ThemeProvider";

/** Alterna entre claro/escuro (Módulo 14 — dark mode opcional). */
export function ThemeToggle() {
  const { tema, alternarTema } = useTheme();
  const escuro = tema === "dark";

  return (
    <button
      onClick={alternarTema}
      aria-label={escuro ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={escuro ? "Tema claro" : "Tema escuro"}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-ink/15 text-ink/60 transition-colors hover:bg-surface dark:border-white/15 dark:text-white/60 dark:hover:bg-white/5"
    >
      {escuro ? (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
