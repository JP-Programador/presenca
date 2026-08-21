import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { atualizarModoAtendimento } from "@/services/coordenacaoService";

interface AtendimentoConfigToggleProps {
  exigeSaidaAtual: boolean;
  onAtualizado: (novoValor: boolean) => void;
}

/** Só o líder vê isso — decide se a equipe inteira dele precisa registrar também a saída (finalização), ou só a presença. Mesmo link público pra ambos os modos. */
export function AtendimentoConfigToggle({ exigeSaidaAtual, onAtualizado }: AtendimentoConfigToggleProps) {
  const [salvando, setSalvando] = useState(false);

  async function escolher(exigeSaida: boolean) {
    if (exigeSaida === exigeSaidaAtual) return;
    setSalvando(true);
    try {
      await atualizarModoAtendimento(exigeSaida);
      onAtualizado(exigeSaida);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardBody className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink dark:text-white">Modo de presença da equipe</p>
          <p className="text-xs text-ink/50 dark:text-white/50">
            Mesmo link público de sempre — só muda se a equipe também precisa registrar a saída/finalização.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={!exigeSaidaAtual ? "primary" : "secondary"}
            size="md"
            disabled={salvando}
            onClick={() => escolher(false)}
          >
            Somente presença
          </Button>
          <Button
            variant={exigeSaidaAtual ? "primary" : "secondary"}
            size="md"
            disabled={salvando}
            onClick={() => escolher(true)}
          >
            Presença (entrada e saída)
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
