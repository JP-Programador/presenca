import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { StatusDiaRegistro } from "@/types/status";

interface AcoesPopupMapaProps {
  row: StatusDiaRegistro;
  onAprovar: () => Promise<void>;
  onRejeitar: () => Promise<void>;
}

/**
 * Aprovar/rejeitar direto no popup do mapa — evita o líder ter que rolar até
 * o painel de pendências só pra decidir uma marcação que ele acabou de ver
 * no mapa (com endereço, horário e tudo mais já visíveis ali).
 */
export function AcoesPopupMapa({ row, onAprovar, onRejeitar }: AcoesPopupMapaProps) {
  const [processando, setProcessando] = useState<"aprovar" | "rejeitar" | null>(null);

  if (row.status !== "PENDENTE") return null;

  async function executar(acao: "aprovar" | "rejeitar", fn: () => Promise<void>) {
    setProcessando(acao);
    try {
      await fn();
    } finally {
      setProcessando(null);
    }
  }

  return (
    <div className="flex gap-1.5">
      <Button
        variant="secondary"
        size="md"
        className="!h-8 !px-2.5 !text-xs"
        disabled={processando !== null}
        onClick={() => executar("rejeitar", onRejeitar)}
        loading={processando === "rejeitar"}
      >
        Rejeitar
      </Button>
      <Button
        variant="primary"
        size="md"
        className="!h-8 !px-2.5 !text-xs"
        disabled={processando !== null}
        onClick={() => executar("aprovar", onAprovar)}
        loading={processando === "aprovar"}
      >
        Aprovar
      </Button>
    </div>
  );
}
