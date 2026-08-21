import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import * as atendimentoService from "@/services/atendimentoService";
import type { AtendimentoPendente } from "@/services/atendimentoService";

function formatarHora(iso?: string) {
  if (!iso) return "?";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

interface AtendimentosPendentesPainelProps {
  /** Auditor/leitura: sem botões de decisão, só visualização. */
  somenteLeitura?: boolean;
}

/**
 * Saídas de atendimento aguardando aprovação — independente do status_dia
 * (a presença do dia já foi decidida quando a ENTRADA foi aprovada). Lista
 * à parte porque essa aprovação não é um status_dia, então não cabe no
 * StatusActionMenu/PendenciasPainel existentes.
 */
export function AtendimentosPendentesPainel({ somenteLeitura }: AtendimentosPendentesPainelProps) {
  const [itens, setItens] = useState<AtendimentoPendente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);

  async function carregar() {
    try {
      setItens(await atendimentoService.listarAtendimentosPendentes());
    } catch {
      // Painel informativo — falha silenciosa não deve travar o resto da tela.
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 60_000);
    return () => clearInterval(intervalo);
  }, []);

  async function decidir(id: string, aprovar: boolean) {
    setProcessando(id);
    try {
      await (aprovar ? atendimentoService.aprovarSaida(id) : atendimentoService.rejeitarSaida(id));
      setItens((prev) => prev.filter((i) => i.id !== id));
    } finally {
      setProcessando(null);
    }
  }

  if (carregando || itens.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <h2 className="text-sm font-semibold text-ink dark:text-white">Saídas de atendimento pendentes</h2>
        <p className="text-xs text-ink/50 dark:text-white/50">
          Aprovação independente da presença do dia — o técnico já está marcado como presente desde a entrada.
        </p>
      </CardHeader>
      <CardBody>
        <ul className="flex flex-col gap-3">
          {itens.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded-md border border-ink/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-white/10"
            >
              <div>
                <p className="font-semibold text-ink dark:text-white">{item.colaborador_nome ?? "Colaborador"}</p>
                <p className="text-xs text-ink/60 dark:text-white/60">
                  Matrícula {item.colaborador_matricula} · Entrada {formatarHora(item.entrada_horario_registrado)} ·
                  Saída {formatarHora(item.horario_registrado)}
                </p>
                {item.endereco_completo && (
                  <p className="text-xs text-ink/50 dark:text-white/50">{item.endereco_completo}</p>
                )}
              </div>
              {!somenteLeitura && (
                <div className="flex gap-2 sm:shrink-0">
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={processando === item.id}
                    onClick={() => decidir(item.id, false)}
                  >
                    Rejeitar
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    loading={processando === item.id}
                    onClick={() => decidir(item.id, true)}
                  >
                    Aprovar
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
