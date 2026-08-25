import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { ALTURA_TABELA_COMPACTA } from "@/lib/uiConstantes";
import { formatarDataBR, formatarHoraBR } from "@/lib/formato";
import { listarCheckinsPertoCasa, type CheckinPertoCasa } from "@/services/alertasService";

interface TabelaCheckinsPertoCasaProps {
  /** Clicar numa linha centraliza o mapa acima/ao lado nessa marcação. */
  onSelecionar: (ponto: { latitude: number; longitude: number; label: string }) => void;
}

const COLUNAS_EXPORTACAO = [
  { chave: "colaborador_nome" as const, titulo: "Colaborador" },
  { chave: "colaborador_matricula" as const, titulo: "Matrícula" },
  { chave: "data_referencia" as const, titulo: "Data", formatar: (v: unknown) => formatarDataBR(v as string) },
  { chave: "horario_registrado" as const, titulo: "Horário", formatar: (v: unknown) => formatarHoraBR(v as string) },
  { chave: "tipo_marcacao" as const, titulo: "Marcação" },
  { chave: "distancia_km" as const, titulo: "Distância (km)" },
];

/**
 * Histórico de marcações feitas perto da residência cadastrada do
 * colaborador — clicar numa linha foca a marcação no mapa operacional
 * (mesmo componente, sem duplicar mapa).
 */
export function TabelaCheckinsPertoCasa({ onSelecionar }: TabelaCheckinsPertoCasaProps) {
  const [linhas, setLinhas] = useState<CheckinPertoCasa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  useEffect(() => {
    listarCheckinsPertoCasa(30)
      .then(setLinhas)
      .catch(() => setLinhas([]))
      .finally(() => setCarregando(false));
  }, []);

  function selecionar(l: CheckinPertoCasa) {
    if (l.latitude == null || l.longitude == null) return;
    setSelecionadoId(l.alerta_id);
    onSelecionar({ latitude: l.latitude, longitude: l.longitude, label: `${l.colaborador_nome} — ${formatarDataBR(l.data_referencia)}` });
  }

  if (carregando) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink dark:text-white">Marcações perto de casa</h2>
          <p className="text-xs text-ink/50 dark:text-white/50">
            Últimos 30 dias — clique numa linha pra ver a marcação no mapa acima.
          </p>
        </div>
        {linhas.length > 0 && (
          <ExportButtons dados={linhas} colunas={COLUNAS_EXPORTACAO} nomeBase="marcacoes-perto-de-casa" />
        )}
      </CardHeader>
      <CardBody>
        {linhas.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink/50 dark:text-white/50">
            Nenhuma marcação perto de residência cadastrada nos últimos 30 dias.
          </p>
        ) : (
          <div className={`overflow-x-auto rounded-lg border border-ink/10 dark:border-white/10 ${ALTURA_TABELA_COMPACTA}`}>
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="sticky top-0 bg-white dark:bg-[#242424]">
                <tr className="border-b border-ink/10 bg-surface text-xs uppercase tracking-wide text-ink/50 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                  <th className="px-4 py-2">Colaborador</th>
                  <th className="px-4 py-2">Data</th>
                  <th className="px-4 py-2">Horário</th>
                  <th className="px-4 py-2">Marcação</th>
                  <th className="px-4 py-2">Distância</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr
                    key={l.alerta_id}
                    onClick={() => selecionar(l)}
                    className={[
                      "cursor-pointer border-b border-ink/5 last:border-0 hover:bg-surface dark:border-white/5 dark:hover:bg-white/5",
                      selecionadoId === l.alerta_id ? "bg-primary/5" : "",
                    ].join(" ")}
                  >
                    <td className="px-4 py-2.5 font-medium text-ink dark:text-white">{l.colaborador_nome}</td>
                    <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">{formatarDataBR(l.data_referencia)}</td>
                    <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">{formatarHoraBR(l.horario_registrado)}</td>
                    <td className="px-4 py-2.5 text-ink/60 dark:text-white/60 capitalize">{l.tipo_marcacao ?? "—"}</td>
                    <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">
                      {l.distancia_km != null ? `${l.distancia_km} km` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
