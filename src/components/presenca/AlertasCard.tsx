import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import * as alertasService from "@/services/alertasService";
import type { Alerta } from "@/services/alertasService";

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

  async function marcarComoLido(id: string) {
    setMarcando(id);
    try {
      await alertasService.marcarAlertaComoLido(id);
      setAlertas((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setMarcando(null);
    }
  }

  if (carregando || alertas.length === 0) return null;

  return (
    <Card className="mb-6 border-[#8A6200]/30">
      <CardHeader>
        <h2 className="text-sm font-semibold text-ink dark:text-white">Alertas</h2>
        <p className="text-xs text-ink/50 dark:text-white/50">
          Avisos que precisam da sua atenção — férias sobrescritas, check-ins fora do padrão etc.
        </p>
      </CardHeader>
      <CardBody>
        <ul className="flex flex-col gap-3">
          {alertas.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-2 rounded-md border border-[#8A6200]/20 bg-[#FFF3DB]/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:bg-[#8A6200]/10"
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
                onClick={() => marcarComoLido(a.id)}
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
