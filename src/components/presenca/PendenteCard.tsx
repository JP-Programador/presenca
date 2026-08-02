import { useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { obterUrlFoto } from "@/services/presencaService";

interface PendenteCardProps {
  nome: string;
  matricula?: string;
  filial?: string;
  dataReferencia: string;
  descricao: string;
  fotoPath?: string | null;
  onAprovar: () => Promise<void>;
  onRejeitar: () => Promise<void>;
  /** Auditor só lê: some com os botões de aprovar/rejeitar e mostra um aviso. */
  somenteLeitura?: boolean;
}

/** Linha de decisão usada tanto para registros pendentes quanto para justificativas. */
export function PendenteCard({
  nome,
  matricula,
  filial,
  dataReferencia,
  descricao,
  fotoPath,
  onAprovar,
  onRejeitar,
  somenteLeitura,
}: PendenteCardProps) {
  const [processando, setProcessando] = useState<"aprovar" | "rejeitar" | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [carregandoFoto, setCarregandoFoto] = useState(false);

  async function verFoto() {
    if (!fotoPath) return;
    setCarregandoFoto(true);
    const url = await obterUrlFoto(fotoPath);
    setFotoUrl(url);
    setCarregandoFoto(false);
  }

  async function aprovar() {
    setProcessando("aprovar");
    try {
      await onAprovar();
    } finally {
      setProcessando(null);
    }
  }

  async function rejeitar() {
    setProcessando("rejeitar");
    try {
      await onRejeitar();
    } finally {
      setProcessando(null);
    }
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">{nome}</p>
            <p className="text-xs text-ink/50">
              {matricula && <>Matrícula {matricula} · </>}
              {filial}
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-ink/50">
            {new Date(dataReferencia).toLocaleDateString("pt-BR")}
          </span>
        </div>

        <p className="text-sm text-ink/70">{descricao}</p>

        {fotoPath && (
          <div>
            {fotoUrl ? (
              <img
                src={fotoUrl}
                alt={`Foto do registro de ${nome}`}
                className="h-32 w-32 rounded-md border border-ink/10 object-cover"
              />
            ) : (
              <Button variant="ghost" size="md" onClick={verFoto} loading={carregandoFoto}>
                Ver foto do registro
              </Button>
            )}
          </div>
        )}

        {somenteLeitura ? (
          <p className="border-t border-ink/10 pt-3 text-xs font-medium text-ink/40">
            Acesso de auditor — somente leitura, sem aprovar/rejeitar.
          </p>
        ) : (
          <div className="flex gap-2 border-t border-ink/10 pt-3">
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={rejeitar}
              loading={processando === "rejeitar"}
              disabled={processando !== null}
            >
              Rejeitar
            </Button>
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={aprovar}
              loading={processando === "aprovar"}
              disabled={processando !== null}
            >
              Aprovar
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
