import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import * as statusDiaService from "@/services/statusDiaService";
import { listarColaboradores } from "@/services/colaboradoresService";
import { exportarCSV } from "@/services/exportService";
import { hojeISO } from "@/lib/calendario";
import {
  META_PLANTA_DISPONIVEL,
  calcularSerieDiaria,
  calcularQVP,
  mapearLideres,
  calcularRankingPorLider,
  calcularHeatmapFaltas,
  type PontoDiario,
  type RankingLiderPlanta,
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
 * Analytics e Histórico Mensal (visão coordenador/executivo): evolução
 * diária da planta disponível vs meta, ranking por líder, ofensores
 * (faltas x atestados) por líder, e heatmap de faltas por dia da semana.
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

  const mapaLideres = useMemo(() => mapearLideres(colaboradores), [colaboradores]);

  const rankingLideres = useMemo<RankingLiderPlanta[]>(
    () => calcularRankingPorLider(statusMes, mapaLideres, serieDiaria.length),
    [statusMes, mapaLideres, serieDiaria.length]
  );

  const heatmap = useMemo(() => calcularHeatmapFaltas(statusMes, inicio, fim), [statusMes, inicio, fim]);

  function exportarSerieDiaria() {
    exportarCSV(
      serieDiaria.map((p) => ({ data: p.data, presentes: p.presentes, pct: `${p.pct}%` })),
      [
        { chave: "data", titulo: "Data" },
        { chave: "presentes", titulo: "Presentes" },
        { chave: "pct", titulo: "% Planta disponível" },
      ],
      `evolucao-planta-${mes}.csv`
    );
  }

  const maxSemanas = useMemo(() => Math.max(0, ...heatmap.celulas.map((c) => c.semana)) + 1, [heatmap]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-ink dark:text-white">Analytics e histórico mensal</h2>
          <p className="text-xs text-ink/50 dark:text-white/50">
            Visão executiva: evolução da planta, ranking e padrões de ausência do mês.
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
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="sm:col-span-2">
              <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-ink dark:text-white">Evolução mensal da planta</h3>
                  <p className="text-xs text-ink/50 dark:text-white/50">
                    % de planta disponível por dia, contra a meta de {META_PLANTA_DISPONIVEL}%.
                  </p>
                </div>
                <Button variant="secondary" size="md" onClick={exportarSerieDiaria} disabled={serieDiaria.length === 0}>
                  Exportar CSV
                </Button>
              </CardHeader>
              <CardBody>
                {serieDiaria.length === 0 ? (
                  <p className="py-10 text-center text-sm text-ink/50 dark:text-white/50">Sem dados nesse mês.</p>
                ) : (
                  <GraficoLinha serie={serieDiaria} meta={META_PLANTA_DISPONIVEL} />
                )}
              </CardBody>
            </Card>

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
                <BarraProgresso
                  pct={qvp.diasTotais > 0 ? (qvp.diasNaMeta / qvp.diasTotais) * 100 : 0}
                  cor="bg-primary"
                />
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
          </div>

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-ink dark:text-white">Ranking de líderes — planta disponível</h3>
              <p className="text-xs text-ink/50 dark:text-white/50">Média de % de planta disponível no mês, por líder.</p>
            </CardHeader>
            <CardBody>
              {rankingLideres.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink/50 dark:text-white/50">Sem dados de líderes nesse mês.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {rankingLideres.map((l) => (
                    <div key={l.lider_id} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 truncate text-sm text-ink dark:text-white">{l.lider_nome}</span>
                      <div className="flex-1">
                        <BarraProgresso pct={l.pctMedio} cor={l.pctMedio >= META_PLANTA_DISPONIVEL ? "bg-[#2E7D32]" : "bg-warning"} />
                      </div>
                      <span className="w-12 shrink-0 text-right text-sm font-semibold text-ink dark:text-white">
                        {l.pctMedio}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-ink dark:text-white">Ofensores por líder</h3>
              <p className="text-xs text-ink/50 dark:text-white/50">Faltas (vermelho) x Atestados (laranja) acumulados no mês.</p>
            </CardHeader>
            <CardBody>
              {rankingLideres.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink/50 dark:text-white/50">Sem dados de líderes nesse mês.</p>
              ) : (
                <GraficoOfensores dados={rankingLideres} />
              )}
            </CardBody>
          </Card>

          <Card>
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
        </>
      )}
    </div>
  );
}

function GraficoLinha({ serie, meta }: { serie: PontoDiario[]; meta: number }) {
  const largura = 700;
  const altura = 160;
  const max = Math.max(100, ...serie.map((p) => p.pct));
  const passoX = serie.length > 1 ? largura / (serie.length - 1) : 0;

  const pontos = serie.map((p, i) => {
    const x = i * passoX;
    const y = altura - (p.pct / max) * altura;
    return { x, y, p };
  });

  const linha = pontos.map((pt) => `${pt.x},${pt.y}`).join(" ");
  const yMeta = altura - (meta / max) * altura;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${largura} ${altura + 24}`} className="h-48 w-full min-w-[500px]">
        <line x1={0} y1={yMeta} x2={largura} y2={yMeta} stroke="#8A6200" strokeWidth={1} strokeDasharray="4 3" />
        <text x={largura - 2} y={yMeta - 4} textAnchor="end" fontSize={10} fill="#8A6200">
          Meta {meta}%
        </text>
        <polyline points={linha} fill="none" strokeWidth={2} className="stroke-primary" />
        {pontos.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r={2.5} className="fill-primary">
            <title>
              {pt.p.data}: {pt.p.pct}% ({pt.p.presentes} presentes)
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

function GraficoOfensores({ dados }: { dados: RankingLiderPlanta[] }) {
  const max = Math.max(1, ...dados.map((d) => d.faltas + d.atestados));
  return (
    <div className="flex flex-col gap-3">
      {dados
        .filter((d) => d.faltas + d.atestados > 0)
        .sort((a, b) => b.faltas + b.atestados - (a.faltas + a.atestados))
        .map((d) => (
          <div key={d.lider_id} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-sm text-ink dark:text-white">{d.lider_nome}</span>
            <div className="flex h-4 flex-1 overflow-hidden rounded-full bg-ink/5 dark:bg-white/5">
              <div
                className="h-full bg-danger"
                style={{ width: `${(d.faltas / max) * 100}%` }}
                title={`${d.faltas} falta(s)`}
              />
              <div
                className="h-full bg-[#E0964D]"
                style={{ width: `${(d.atestados / max) * 100}%` }}
                title={`${d.atestados} atestado(s)`}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-xs text-ink/60 dark:text-white/60">
              {d.faltas}F · {d.atestados}A
            </span>
          </div>
        ))}
      {dados.every((d) => d.faltas + d.atestados === 0) && (
        <p className="py-4 text-center text-sm text-ink/50 dark:text-white/50">Nenhuma falta ou atestado no mês.</p>
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
