import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import * as alertasService from "@/services/alertasService";
import type { Alerta, TipoAlerta } from "@/services/alertasService";

// Mais crítico primeiro — "sem fechamento" (12h+, urgente) na frente de
// avisos mais leves. Dentro do mesmo tipo, mais recente primeiro.
const PRIORIDADE_TIPO: Record<TipoAlerta, number> = {
  atendimento_sem_fechamento: 0,
  checkin_proximo_residencia: 1,
  ferias_sobrescreveu_registro: 2,
  atendimento_pendente_fechamento: 3,
};

function formatarData(iso?: string) {
  if (!iso) return "?";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
}

function textoAlerta(a: Alerta): string {
  if (a.tipo === "checkin_proximo_residencia") {
    return `Check-in de ${a.detalhes.tipo_marcacao ?? "marcação"} em ${formatarData(
      a.detalhes.data_referencia
    )} foi feito a ${a.detalhes.distancia_km ?? "?"}km da residência cadastrada.`;
  }
  if (a.tipo === "atendimento_pendente_fechamento") {
    return `Entrada aprovada há ${a.detalhes.horas_decorridas ?? "8+"}h e ainda sem saída aprovada. A presença continua normal — é só um lembrete pra cobrar o fechamento.`;
  }
  if (a.tipo === "atendimento_sem_fechamento") {
    return `⚠ Entrada aprovada há ${a.detalhes.horas_decorridas ?? "12+"}h SEM fechamento. Última localização: ${
      a.detalhes.endereco_completo ?? "não disponível"
    }.`;
  }
  return `Férias ${formatarData(a.detalhes.data_inicio)} a ${formatarData(a.detalhes.data_fim)} — sobrescreveu ${
    a.detalhes.datas_conflito?.length ?? 0
  } dia(s) já lançado(s).`;
}

/** Avisos assíncronos endereçados ao usuário logado (férias sobrescritas, check-in perto de casa etc.). */
export function AlertasCard() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [marcando, setMarcando] = useState<string | null>(null);

  async function carregar() {
    try {
      setAlertas(await alertasService.listarAlertasNaoLidos());
    } catch {
      // Alerta é informativo — falha silenciosa não deve travar o resto do painel.
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 60_000);
    return () => clearInterval(intervalo);
  }, []);

  async function marcarComoLido(a: Alerta) {
    setMarcando(a.id);
    try {
      await alertasService.marcarAlertaComoLido(a.ids_relacionados);
      setAlertas((prev) => prev.filter((item) => item.id !== a.id));
    } finally {
      setMarcando(null);
    }
  }

  const alertasOrdenados = useMemo(
    () =>
      [...alertas].sort((a, b) => {
        const prioridade = PRIORIDADE_TIPO[a.tipo] - PRIORIDADE_TIPO[b.tipo];
        if (prioridade !== 0) return prioridade;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }),
    [alertas]
  );

  if (carregando || alertas.length === 0) return null;

  return (
    <Card className="mb-6 border-[#8A6200]/30">
      <CardHeader>
        <h2 className="text-sm font-semibold text-ink dark:text-white">Alertas</h2>
        <p className="text-xs text-ink/50 dark:text-white/50">
          Avisos que precisam da sua atenção — férias sobrescritas, check-ins fora do padrão etc. Os mais
          importantes aparecem primeiro.
        </p>
      </CardHeader>
      <CardBody>
        <ul className="flex max-h-[480px] flex-col gap-3 overflow-y-auto">
          {alertasOrdenados.map((a) => (
            <li
              key={a.id}
              className={[
                "flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between",
                a.tipo === "atendimento_sem_fechamento"
                  ? "border-danger/30 bg-[#FBE7E7]/50 dark:bg-danger/10"
                  : "border-[#8A6200]/20 bg-[#FFF3DB]/40 dark:bg-[#8A6200]/10",
              ].join(" ")}
            >
              <div>
                <p className="font-semibold text-ink dark:text-white">{a.colaborador_nome ?? "Colaborador"}</p>
                <p className="text-xs text-ink/60 dark:text-white/60">{textoAlerta(a)}</p>
              </div>
              <Button
                variant="secondary"
                size="md"
                disabled={marcando === a.id}
                loading={marcando === a.id}
                onClick={() => marcarComoLido(a)}
              >
                Marcar como lido
              </Button>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
