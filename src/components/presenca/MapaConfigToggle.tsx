import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { atualizarDispensaMapa } from "@/services/coordenacaoService";

interface MapaConfigToggleProps {
  dispensaMapaAtual: boolean;
  onAtualizado: (novoValor: boolean) => void;
}

/** Só o líder vê isso — se a equipe dele nunca faz check-in por GPS (marcação sempre manual), o mapa não serve de nada e pode ser escondido. */
export function MapaConfigToggle({ dispensaMapaAtual, onAtualizado }: MapaConfigToggleProps) {
  const [salvando, setSalvando] = useState(false);

  async function escolher(dispensa: boolean) {
    if (dispensa === dispensaMapaAtual) return;
    setSalvando(true);
    try {
      await atualizarDispensaMapa(dispensa);
      onAtualizado(dispensa);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardBody className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink dark:text-white">Mapa da equipe</p>
          <p className="text-xs text-ink/50 dark:text-white/50">
            Se a equipe nunca faz check-in por GPS (marcação sempre manual), pode esconder o mapa.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={!dispensaMapaAtual ? "primary" : "secondary"}
            size="md"
            disabled={salvando}
            onClick={() => escolher(false)}
          >
            Mostrar mapa
          </Button>
          <Button
            variant={dispensaMapaAtual ? "primary" : "secondary"}
            size="md"
            disabled={salvando}
            onClick={() => escolher(true)}
          >
            Esconder mapa
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
