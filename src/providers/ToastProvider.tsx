import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastTipo = "sucesso" | "erro" | "info";

interface Toast {
  id: number;
  tipo: ToastTipo;
  mensagem: string;
}

interface ToastContextValue {
  mostrar: (mensagem: string, tipo?: ToastTipo) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ESTILOS: Record<ToastTipo, string> = {
  sucesso: "bg-[#2E7D32] text-white",
  erro: "bg-danger text-white",
  info: "bg-ink text-white dark:bg-white dark:text-ink",
};

let proximoId = 1;

/** Toasts globais (Módulo 14) — feedback rápido de ações (salvar, erro, etc.) sem depender de <Alert> inline em cada tela. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const mostrar = useCallback((mensagem: string, tipo: ToastTipo = "info") => {
    const id = proximoId++;
    setToasts((atual) => [...atual, { id, tipo, mensagem }]);
    setTimeout(() => {
      setToasts((atual) => atual.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ mostrar }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={[
              "pointer-events-auto w-full max-w-sm rounded-md px-4 py-3 text-sm font-medium shadow-lg",
              ESTILOS[toast.tipo],
            ].join(" ")}
          >
            {toast.mensagem}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const contexto = useContext(ToastContext);
  if (!contexto) {
    throw new Error("useToast precisa ser usado dentro de <ToastProvider>. Verifique src/main.tsx.");
  }
  return contexto;
}
