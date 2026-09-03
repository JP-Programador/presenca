import { useState, type ReactNode } from "react";

interface SecaoColapsavelProps {
  titulo: string;
  children: ReactNode;
  /** Começa fechado — padrão é aberto. */
  iniciaFechado?: boolean;
}

/** Faixa com título + botão "−"/"+" pra esconder/mostrar uma seção inteira da tela, sem perder o lugar dela. */
export function SecaoColapsavel({ titulo, children, iniciaFechado }: SecaoColapsavelProps) {
  const [aberto, setAberto] = useState(!iniciaFechado);

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="mb-2 flex w-full items-center justify-between gap-2 rounded-md border border-ink/10 bg-white px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-surface dark:border-white/10 dark:bg-[#242424] dark:text-white dark:hover:bg-white/5"
        aria-expanded={aberto}
      >
        <span>{titulo}</span>
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-base leading-none text-ink/60 dark:bg-white/10 dark:text-white/60"
          aria-hidden="true"
        >
          {aberto ? "−" : "+"}
        </span>
      </button>
      {aberto && children}
    </div>
  );
}
