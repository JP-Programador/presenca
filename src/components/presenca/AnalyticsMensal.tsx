import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import * as statusDiaService from "@/services/statusDiaService";
import { listarColaboradores } from "@/services/colaboradoresService";
import { hojeISO } from "@/lib/calendario";
import {
  META_PLANTA_DISPONIVEL,
  calcularSerieDiaria,
  calcularQVP,
  calcularHeatmapFaltas,
  type PontoDiario,
} from "@/lib/analytics";
import type { Colaborador } from "@/types/domain";
import type { StatusDiaRegistro } from "@/types/status";

function mesAtualISO(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function limitesDoMes(mesISO: string): { inicio: string; fim: string } {
  const [ano, mes] = mesISO.split("-").map(Number);
  const inicio = `${mesISO}-01`;
  const hoje = hojeISO();
  const ultimoDiaCalendario = new Date(ano, mes, 0).getDate();
  const fimCalendario = `${mesISO}-${String(ultimoDiaCalendario).padStart(2, "0")}`;
  // Mês corrente: só considera até hoje (dias futuros não têm dado). Mês
  // passado: considera o mês inteiro.
  const fim = fimCalendario > hoje ? hoje : fimCalendario;
  return { inicio, fim };
}

function mesAnteriorISO(mesISO: string): string {
  const [ano, mes] = mesISO.split("-").map(Number);
  const d = new Date(ano, mes - 2, 1); // mes é 1-indexed; -2 volta um mês
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function mediaPct(serie: PontoDiario[]): number | null {
  if (serie.length === 0) return null;
  return Math.round((serie.reduce((soma, p) => soma + p.pct, 0) / serie.length) * 10) / 10;
}

/** Barrinha de progresso simples (usada no card de QVP). */
function BarraProgresso({ pct, cor }: { pct: number; cor: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
      <div className={["h-full rounded-full", cor].join(" ")} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

/**
 * QVP (Quadro Operacional Pleno) e padrão semanal de faltas — complementa a
 * visão acumulada por período (cards/ofensores/ranking, que ficam na tela
 * principal) com dois indicadores que só fazem sentido olhando um mês
 * fechado: quantos dias bateram a meta, e em que dia da semana as faltas
 * se concentram.
 */
export function AnalyticsMensal() {
  const [mes, setMes] = useState(mesAtualISO());
  const [statusMes, setStatusMes] = useState<StatusDiaRegistro[]>([]);
  const [statusMesAnterior, setStatusMesAnterior] = useState<StatusDiaRegistro[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const { inicio, fim } = useMemo(() => limitesDoMes(mes), [mes]);
  const mesAnterior = useMemo(() => mesAnteriorISO(mes), [mes]);
  const { inicio: inicioAnterior, fim: fimAnterior } = useMemo(() => limitesDoMes(mesAnterior), [mesAnterior]);

  useEffect(() => {
    setCarregando(true);
    setErro(null);
    Promise.all([
      statusDiaService.listarStatusDiaPeriodo(inicio, fim),
      statusDiaService.listarStatusDiaPeriodo(inicioAnterior, fimAnterior),
      listarColaboradores(),
    ])
      .then(([status, statusAnterior, colabs]) => {
        setStatusMes(status);
        setStatusMesAnterior(statusAnterior);
        setColaboradores(colabs);
      })
      .catch(() => setErro("Não foi possível carregar o histórico mensal."))
      .finally(() => setCarregando(false));
  }, [inicio, fim, inicioAnterior, fimAnterior]);

  const escalados = useMemo(() => colaboradores.filter((c) => c.ativo).length, [colaboradores]);

  const serieDiaria = useMemo<PontoDiario[]>(
    () => calcularSerieDiaria(statusMes, escalados, inicio, fim),
    [statusMes, escalados, inicio, fim]
  );

  const serieAnterior = useMemo<PontoDiario[]>(
    () => calcularSerieDiaria(statusMesAnterior, escalados, inicioAnterior, fimAnterior),
    [statusMesAnterior, escalados, inicioAnterior, fimAnterior]
  );

  const qvp = useMemo(() => calcularQVP(serieDiaria), [serieDiaria]);

  const tendencia = useMemo(() => {
    const atual = mediaPct(serieDiaria);
    const anterior = mediaPct(serieAnterior);
    if (atual == null || anterior == null) return null;
    return Math.round((atual - anterior) * 10) / 10;
  }, [serieDiaria, serieAnterior]);

  const heatmap = useMemo(() => calcularHeatmapFaltas(statusMes, inicio, fim), [statusMes, inicio, fim]);
  const maxSemanas = useMemo(() => Math.max(0, ...heatmap.celulas.map((c) => c.semana)) + 1, [heatmap]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-ink dark:text-white">QVP e padrão semanal</h2>
          <p className="text-xs text-ink/50 dark:text-white/50">
            Meta batida no mês e em que dias da semana as faltas se concentram.
          </p>
        </div>
        <input
          type="month"
          value={mes}
          max={mesAtualISO()}
          onChange={(e) => setMes(e.target.value)}
          className="h-10 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
        />
      </div>

      {erro && <p className="text-sm text-danger">{erro}</p>}

      {carregando ? (
        <div className="flex justify-center py-12">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-ink dark:text-white">QVP — Quadro Operacional Pleno</h3>
              <p className="text-xs text-ink/50 dark:text-white/50">
                Dias do mês em que a meta de {META_PLANTA_DISPONIVEL}% foi atingida.
              </p>
            </CardHeader>
            <CardBody className="flex flex-col justify-center gap-3 py-8 text-center">
              <p className="text-4xl font-bold text-primary">
                {qvp.diasNaMeta}
                <span className="text-xl text-ink/40 dark:text-white/40"> / {qvp.diasTotais}</span>
              </p>
              <p className="text-xs text-ink/50 dark:text-white/50">dias com meta atingida</p>
              <BarraProgresso pct={qvp.diasTotais > 0 ? (qvp.diasNaMeta / qvp.diasTotais) * 100 : 0} cor="bg-primary" />
              {tendencia != null && (
                <p
                  className={[
                    "text-xs font-semibold",
                    tendencia > 0 ? "text-[#2E7D32]" : tendencia < 0 ? "text-danger" : "text-ink/50 dark:text-white/50",
                  ].join(" ")}
                  title="Média diária de % planta disponível, mês atual vs anterior"
                >
                  {tendencia > 0 ? "▲" : tendencia < 0 ? "▼" : "—"} {tendencia > 0 ? "+" : ""}
                  {tendencia}% vs mês anterior
                </p>
              )}
            </CardBody>
          </Card>

          <Card className="sm:col-span-2">
            <CardHeader>
              <h3 className="text-sm font-semibold text-ink dark:text-white">Padrão de ausências por dia da semana</h3>
              <p className="text-xs text-ink/50 dark:text-white/50">
                Faltas por dia útil — quanto mais escuro, mais faltas naquele dia.
              </p>
            </CardHeader>
            <CardBody>
              {heatmap.celulas.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink/50 dark:text-white/50">Sem dados nesse mês.</p>
              ) : (
                <HeatmapFaltas heatmap={heatmap} maxSemanas={maxSemanas} />
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

function HeatmapFaltas({
  heatmap,
  maxSemanas,
}: {
  heatmap: ReturnType<typeof calcularHeatmapFaltas>;
  maxSemanas: number;
}) {
  const diasUteis = [1, 2, 3, 4, 5]; // Seg-Sex

  function corCelula(faltas: number) {
    if (faltas === 0) return "bg-surface dark:bg-white/5";
    const intensidade = heatmap.maxFaltas > 0 ? faltas / heatmap.maxFaltas : 0;
    if (intensidade > 0.66) return "bg-danger text-white";
    if (intensidade > 0.33) return "bg-[#F0A0A0]";
    return "bg-[#FBE7E7]";
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[360px] border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="text-xs font-normal text-ink/40 dark:text-white/40"> </th>
            {diasUteis.map((d) => (
              <th key={d} className="px-2 text-xs font-semibold text-ink/60 dark:text-white/60">
                {heatmap.nomesDias[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxSemanas }).map((_, semana) => (
            <tr key={semana}>
              <td className="pr-2 text-xs text-ink/40 dark:text-white/40">S{semana + 1}</td>
              {diasUteis.map((dow) => {
                const celula = heatmap.celulas.find((c) => c.semana === semana && c.diaSemana === dow);
                if (!celula) return <td key={dow} className="h-10 w-14 rounded bg-transparent" />;
                return (
                  <td
                    key={dow}
                    className={["h-10 w-14 rounded text-center text-sm font-semibold", corCelula(celula.faltas)].join(" ")}
                    title={`${celula.data}: ${celula.faltas} falta(s)`}
                  >
                    {celula.faltas > 0 ? celula.faltas : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
