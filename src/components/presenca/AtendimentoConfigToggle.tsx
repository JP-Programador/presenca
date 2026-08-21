import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { atualizarModoAtendimento } from "@/services/coordenacaoService";

interface AtendimentoConfigToggleProps {
  exigeSaidaAtual: boolean;
  onAtualizado: (novoValor: boolean) => void;
}

/** Só o líder vê isso — decide se a equipe inteira dele precisa registrar também a saída do atendimento, ou só a chegada. */
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
          <p className="text-sm font-semibold text-ink dark:text-white">Atendimento da equipe</p>
          <p className="text-xs text-ink/50 dark:text-white/50">
            Chegada e saída de visita a cliente (tela "/atendimento"), separado da presença diária.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={!exigeSaidaAtual ? "primary" : "secondary"}
            size="md"
            disabled={salvando}
            onClick={() => escolher(false)}
          >
            Só chegada
          </Button>
          <Button
            variant={exigeSaidaAtual ? "primary" : "secondary"}
            size="md"
            disabled={salvando}
            onClick={() => escolher(true)}
          >
            Chegada e saída
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
