import { Card, CardBody } from "@/components/ui/Card";

interface EmptyStateProps {
  mensagem: string;
  acao?: React.ReactNode;
}

/** Estado vazio padrão (Módulo 14) — reutilizado por listas de pendências/justificativas/relatórios. */
export function EmptyState({ mensagem, acao }: EmptyStateProps) {
  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-3 py-10 text-center text-sm text-ink/50 dark:text-white/50">
        <span>{mensagem}</span>
        {acao}
      </CardBody>
    </Card>
  );
}
