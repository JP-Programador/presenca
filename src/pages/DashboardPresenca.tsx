import { useEffect, useMemo, useState } from "react";
import { BrandHeader } from "@/components/layout/BrandHeader";
import { NavPaineis } from "@/components/layout/NavPaineis";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { useAuth } from "@/providers/AuthProvider";
import { hojeISO, intervaloDeDatas } from "@/lib/calendario";
import * as statusDiaService from "@/services/statusDiaService";
import { listarColaboradores } from "@/services/colaboradoresService";
import { listarHorariosEntrada, listarRegistrosAtrasados } from "@/services/dashboardPresencaService";
import { listarSlaStatusDia, ranquearPorFilial } from "@/services/slaService";
import { AnalyticsMensal } from "@/components/presenca/AnalyticsMensal";
import {
  calcularAcumuladoPeriodo,
  calcularTopFaltas,
  calcularTopAtrasos,
  calcularSerieFaltasAtestados,
  mapearLideres,
  calcularRankingPorLider,
  META_PLANTA_DISPONIVEL,
  type PontoFaltasAtestados,
  type RankingLiderPlanta,
} from "@/lib/analytics";
import type { StatusDiaRegistro } from "@/types/status";
import type { Colaborador, RegistroPresenca } from "@/types/domain";

const INTERVALO_MS = 30_000;

/** 5h às 23h — faixa de horário que cobre praticamente todos os turnos. */
const HORAS_GRAFICO = Array.from({ length: 19 }, (_, i) => i + 5);

type PeriodoGlobal = "semana" | "mes" | "30dias" | "personalizado";

const PERIODOS_GLOBAIS: { chave: PeriodoGlobal; label: string }[] = [
  { chave: "semana", label: "Esta semana" },
  { chave: "mes", label: "Este mês" },
  { chave: "30dias", label: "Últimos 30 dias" },
  { chave: "personalizado", label: "Personalizado" },
];

function formatarISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Início do período (fim é sempre hoje, exceto no personalizado). */
function inicioDoPeriodo(periodo: PeriodoGlobal): string {
  const hoje = new Date();
  if (periodo === "semana") {
    const diaSemana = hoje.getDay(); // 0=dom...6=sáb
    const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
    const d = new Date(hoje);
    d.setDate(d.getDate() - diasDesdeSegunda);
    return formatarISO(d);
  }
  if (periodo === "mes") return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
  // 30dias e fallback do personalizado (antes do usuário escolher)
  const d = new Date(hoje);
  d.setDate(d.getDate() - 29);
  return formatarISO(d);
}

interface LinhaFilial {
  filial_id: string;
  filial_nome: string;
  escalados: number;
  presentesTotal: number;
  faltasTotal: number;
  slaMedioMin: number | null;
}

export function DashboardPresenca() {
  // Papel (admin/auditor/coordenador/gestor) já validado por <RequireRole> na definição das rotas.
  const { usuario, sair } = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoGlobal>("semana");
  const [personalizadoInicio, setPersonalizadoInicio] = useState(inicioDoPeriodo("30dias"));
  const [personalizadoFim, setPersonalizadoFim] = useState(hojeISO());

  const { inicio, fim } = useMemo(() => {
    if (periodo === "personalizado") {
      return personalizadoInicio <= personalizadoFim
        ? { inicio: personalizadoInicio, fim: personalizadoFim }
        : { inicio: personalizadoFim, fim: personalizadoInicio };
    }
    return { inicio: inicioDoPeriodo(periodo), fim: hojeISO() };
  }, [periodo, personalizadoInicio, personalizadoFim]);

  const [statusPeriodo, setStatusPeriodo] = useState<StatusDiaRegistro[]>([]);
  const [registrosAtrasados, setRegistrosAtrasados] = useState<RegistroPresenca[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [horariosEntrada, setHorariosEntrada] = useState<string[]>([]);
  const [slaMedioPorFilial, setSlaMedioPorFilial] = useState<Map<string, number>>(new Map());
  const [slaMedioGeral, setSlaMedioGeral] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

  const diasConsiderados = useMemo(() => intervaloDeDatas(inicio, fim).length, [inicio, fim]);

  async function carregar(silencioso = false) {
    if (!silencioso) setCarregando(true);
    setErro(null);
    try {
      const [statusDia, atrasados, colabs, horarios, decisoesSla] = await Promise.all([
        statusDiaService.listarStatusDiaPeriodo(inicio, fim),
        listarRegistrosAtrasados(inicio, fim),
        listarColaboradores(),
        listarHorariosEntrada(hojeISO()),
        listarSlaStatusDia(inicio, fim),
      ]);
      setStatusPeriodo(statusDia);
      setRegistrosAtrasados(atrasados);
      setColaboradores(colabs);
      setHorariosEntrada(horarios);
      setSlaMedioPorFilial(new Map(ranquearPorFilial(decisoesSla).map((f) => [f.filial_id, f.tempo_medio_min])));
      setSlaMedioGeral(
        decisoesSla.length > 0
          ? Math.round((decisoesSla.reduce((s, d) => s + d.minutos, 0) / decisoesSla.length) * 10) / 10
          : null
      );
      setUltimaAtualizacao(new Date());
    } catch {
      setErro("Não foi possível carregar o painel.");
    } finally {
      if (!silencioso) setCarregando(false);
    }
  }

  useEffect(() => {
    if (usuario) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, inicio, fim]);

  useEffect(() => {
    if (!usuario) return;
    const intervalo = setInterval(() => carregar(true), INTERVALO_MS);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, inicio, fim]);

  const escalados = useMemo(() => colaboradores.filter((c) => c.ativo).length, [colaboradores]);

  const acumulado = useMemo(
    () => calcularAcumuladoPeriodo(statusPeriodo, registrosAtrasados, escalados, inicio, fim),
    [statusPeriodo, registrosAtrasados, escalados, inicio, fim]
  );

  const mapaLideres = useMemo(() => mapearLideres(colaboradores), [colaboradores]);

  const topFaltas = useMemo(() => calcularTopFaltas(statusPeriodo, mapaLideres, 5), [statusPeriodo, mapaLideres]);
  const topAtrasos = useMemo(() => calcularTopAtrasos(registrosAtrasados, 5), [registrosAtrasados]);

  const rankingLideres = useMemo<RankingLiderPlanta[]>(
    () => calcularRankingPorLider(statusPeriodo, mapaLideres, diasConsiderados),
    [statusPeriodo, mapaLideres, diasConsiderados]
  );
  const topAbsenteismo = useMemo(
    () =>
      [...rankingLideres]
        .filter((l) => l.taxaAbsenteismo > 0)
        .sort((a, b) => b.taxaAbsenteismo - a.taxaAbsenteismo)
        .slice(0, 5),
    [rankingLideres]
  );
  const topEngajamento = useMemo(() => rankingLideres.slice(0, 5), [rankingLideres]);

  const serieFaltasAtestados = useMemo<PontoFaltasAtestados[]>(
    () => calcularSerieFaltasAtestados(statusPeriodo, inicio, fim),
    [statusPeriodo, inicio, fim]
  );

  const contagemPorHora = useMemo(() => {
    const mapa = new Map<number, number>();
    for (const h of HORAS_GRAFICO) mapa.set(h, 0);
    for (const iso of horariosEntrada) {
      const hora = new Date(iso).getHours();
      if (mapa.has(hora)) mapa.set(hora, (mapa.get(hora) ?? 0) + 1);
    }
    return mapa;
  }, [horariosEntrada]);

  const maxPorHora = useMemo(() => Math.max(1, ...Array.from(contagemPorHora.values())), [contagemPorHora]);

  const linhasPorFilial = useMemo<LinhaFilial[]>(() => {
    const mapa = new Map<string, LinhaFilial>();

    for (const c of colaboradores) {
      if (!c.ativo) continue;
      const linha = mapa.get(c.filial_id) ?? {
        filial_id: c.filial_id,
        filial_nome: c.filial_nome ?? "—",
        escalados: 0,
        presentesTotal: 0,
        faltasTotal: 0,
        slaMedioMin: null,
      };
      linha.escalados += 1;
      mapa.set(c.filial_id, linha);
    }

    for (const s of statusPeriodo) {
      const linha = mapa.get(s.filial_id) ?? {
        filial_id: s.filial_id,
        filial_nome: s.filial_nome ?? "—",
        escalados: 0,
        presentesTotal: 0,
        faltasTotal: 0,
        slaMedioMin: null,
      };
      if (s.status === "PRESENTE") linha.presentesTotal += 1;
      if (s.status === "FALTA") linha.faltasTotal += 1;
      mapa.set(s.filial_id, linha);
    }

    for (const linha of mapa.values()) {
      linha.slaMedioMin = slaMedioPorFilial.get(linha.filial_id) ?? null;
    }

    return Array.from(mapa.values()).sort((a, b) => a.filial_nome.localeCompare(b.filial_nome));
  }, [colaboradores, statusPeriodo, slaMedioPorFilial]);

  if (!usuario) return null; // narrowing de tipo; na prática nunca alcançado (ver RequireRole)

  const ehLider = usuario.perfil === "gestor";
  const periodoLabel = PERIODOS_GLOBAIS.find((p) => p.chave === periodo)?.label ?? "";

  return (
    <div className="min-h-screen bg-surface dark:bg-[#1A1A1A]">
      <BrandHeader
        title="Dashboard de presença"
        subtitle={ehLider ? "Visão acumulada da sua equipe" : "Visão acumulada de todas as filiais"}
        right={<NavPaineis perfil={usuario.perfil} atual="dashboard-presenca" onSair={sair} />}
      />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-md border border-ink/15 bg-white p-1 dark:border-white/15 dark:bg-[#242424]">
              {PERIODOS_GLOBAIS.map((p) => (
                <button
                  key={p.chave}
                  type="button"
                  onClick={() => setPeriodo(p.chave)}
                  className={[
                    "rounded px-2.5 py-1.5 text-xs font-semibold transition-colors",
                    periodo === p.chave
                      ? "bg-primary text-white"
                      : "text-ink/50 hover:bg-surface dark:text-white/50 dark:hover:bg-white/5",
                  ].join(" ")}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {periodo === "personalizado" && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={personalizadoInicio}
                  max={hojeISO()}
                  onChange={(e) => setPersonalizadoInicio(e.target.value)}
                  className="h-9 rounded-md border border-ink/15 bg-white px-2 text-xs text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
                />
                <span className="text-xs text-ink/40 dark:text-white/40">até</span>
                <input
                  type="date"
                  value={personalizadoFim}
                  max={hojeISO()}
                  onChange={(e) => setPersonalizadoFim(e.target.value)}
                  className="h-9 rounded-md border border-ink/15 bg-white px-2 text-xs text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
                />
              </div>
            )}
          </div>
          <span className="text-xs text-ink/40 dark:text-white/40">
            {ultimaAtualizacao
              ? `Última atualização: ${ultimaAtualizacao.toLocaleTimeString("pt-BR")}`
              : "Carregando..."}{" "}
            · atualiza sozinho a cada 30s
          </span>
        </div>

        {erro && (
          <div className="mb-4">
            <Alert variant="danger">{erro}</Alert>
          </div>
        )}

        {carregando ? (
          <div className="flex justify-center py-16">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <MetricCardSimples
                label="Faltas no período"
                valor={String(acumulado.totalFaltas)}
                cor="text-danger"
                tooltip={`Total de faltas registradas em ${periodoLabel.toLowerCase()}.`}
              />
              <MetricCardSimples
                label="Planta disponível (média)"
                valor={`${acumulado.pctMedioPlantaDisponivel}%`}
                cor={acumulado.pctMedioPlantaDisponivel >= META_PLANTA_DISPONIVEL ? "text-[#2E7D32]" : "text-warning"}
                tooltip="Média diária de % de presença no período."
              />
              <MetricCardSimples
                label="Atestados no período"
                valor={String(acumulado.totalAtestados)}
                cor="text-[#E0964D]"
                tooltip="Total de dias marcados como Atestado no período."
              />
              <MetricCardSimples
                label="Atrasos no período"
                valor={String(acumulado.totalAtrasos)}
                cor="text-warning"
                tooltip="Check-ins de entrada registrados como atrasado."
              />
              <MetricCardSimples
                label="SLA médio de ajustes"
                valor={slaMedioGeral != null ? `${slaMedioGeral} min` : "—"}
                cor="text-ink dark:text-white"
                tooltip="Tempo médio que os líderes levam para decidir uma pendência, no período."
              />
            </div>

            <div>
              <h2 className="mb-3 text-base font-semibold text-ink dark:text-white">Top ofensores — {periodoLabel}</h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <PainelTopFaltas dados={topFaltas} />
                <PainelTopAtrasos dados={topAtrasos} />
                {!ehLider && <PainelAbsenteismoLideres dados={topAbsenteismo} />}
                {!ehLider && <PainelEngajamentoLideres dados={topEngajamento} />}
              </div>
            </div>

            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-ink dark:text-white">Evolução: faltas x atestados</h2>
                <p className="text-xs text-ink/50 dark:text-white/50">
                  Dia a dia no período — ajuda a identificar se as faltas se concentram em dias específicos.
                </p>
              </CardHeader>
              <CardBody>
                {serieFaltasAtestados.length === 0 ? (
                  <p className="py-10 text-center text-sm text-ink/50 dark:text-white/50">Sem dados nesse período.</p>
                ) : (
                  <GraficoFaltasAtestados serie={serieFaltasAtestados} />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-ink dark:text-white">Presença por horário de entrada</h2>
                <p className="text-xs text-ink/50 dark:text-white/50">
                  Quantidade de check-ins de entrada hoje, por hora do dia (sempre hoje, independente do período acima).
                </p>
              </CardHeader>
              <CardBody>
                {horariosEntrada.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink/50 dark:text-white/50">
                    Nenhum check-in de entrada hoje ainda.
                  </p>
                ) : (
                  <div className="flex h-40 items-end gap-1 overflow-x-auto">
                    {HORAS_GRAFICO.map((h) => {
                      const total = contagemPorHora.get(h) ?? 0;
                      const alturaPct = (total / maxPorHora) * 100;
                      return (
                        <div key={h} className="flex min-w-[24px] flex-1 flex-col items-center gap-1">
                          <div className="flex h-32 w-full items-end">
                            <div
                              className={[
                                "w-full rounded-t transition-all",
                                total > 0 ? "bg-primary" : "bg-ink/5 dark:bg-white/5",
                              ].join(" ")}
                              style={{ height: `${total > 0 ? Math.max(alturaPct, 4) : 2}%` }}
                              title={`${total} entrada${total === 1 ? "" : "s"} às ${h}h`}
                            />
                          </div>
                          <span className="text-[10px] text-ink/40 dark:text-white/40">{h}h</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-ink dark:text-white">
                  {ehLider ? "Sua filial" : "Comparativo por filial"}
                </h2>
                <p className="text-xs text-ink/50 dark:text-white/50">
                  Escalados, presença, faltas e SLA médio de aprovação — {periodoLabel.toLowerCase()}.
                </p>
              </CardHeader>
              <CardBody>
                {linhasPorFilial.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink/50 dark:text-white/50">Nenhum dado disponível.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-ink/10 dark:border-white/10">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-ink/10 bg-surface text-xs uppercase tracking-wide text-ink/50 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                          <th className="px-4 py-2">Filial</th>
                          <th className="px-4 py-2 text-right">Escalados</th>
                          <th className="px-4 py-2 text-right" title="Soma de presenças no período">
                            Presenças (soma)
                          </th>
                          <th className="px-4 py-2 text-right">% disponível (médio)</th>
                          <th className="px-4 py-2 text-right">Faltas</th>
                          <th className="px-4 py-2 text-right">SLA médio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhasPorFilial.map((l) => {
                          const pct =
                            l.escalados > 0 && diasConsiderados > 0
                              ? Math.round((l.presentesTotal / (l.escalados * diasConsiderados)) * 100)
                              : 0;
                          return (
                            <tr key={l.filial_id} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                              <td className="px-4 py-2.5 font-medium text-ink dark:text-white">{l.filial_nome}</td>
                              <td className="px-4 py-2.5 text-right text-ink/70 dark:text-white/70">{l.escalados}</td>
                              <td className="px-4 py-2.5 text-right text-[#2E7D32]">{l.presentesTotal}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-ink dark:text-white">{pct}%</td>
                              <td className="px-4 py-2.5 text-right text-danger">{l.faltasTotal}</td>
                              <td className="px-4 py-2.5 text-right text-ink/70 dark:text-white/70">
                                {l.slaMedioMin != null ? `${l.slaMedioMin} min` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>

            {!ehLider && <AnalyticsMensal />}
          </div>
        )}
      </main>
    </div>
  );
}

function MetricCardSimples({
  label,
  valor,
  cor,
  tooltip,
}: {
  label: string;
  valor: string;
  cor: string;
  tooltip: string;
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#242424]" title={tooltip}>
      <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink/50 dark:text-white/50">{label}</p>
      <p className={["mt-1 text-2xl font-bold", cor].join(" ")}>{valor}</p>
    </div>
  );
}

function PainelTopFaltas({ dados }: { dados: ReturnType<typeof calcularTopFaltas> }) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-ink dark:text-white">🚨 Top faltas</h3>
        <p className="text-xs text-ink/50 dark:text-white/50">Colaboradores que mais faltaram no período.</p>
      </CardHeader>
      <CardBody>
        {dados.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/50 dark:text-white/50">Nenhuma falta no período.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {dados.map((d, i) => (
              <li key={d.colaborador_id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-ink dark:text-white">
                  <span className="text-ink/40 dark:text-white/40">{i + 1}.</span> {d.nome}
                  <span className="text-xs text-ink/50 dark:text-white/50"> · {d.lider_nome}</span>
                </span>
                <span className="shrink-0 rounded-full bg-[#FBE7E7] px-2 py-0.5 text-xs font-bold text-danger">
                  {d.faltas}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function PainelTopAtrasos({ dados }: { dados: ReturnType<typeof calcularTopAtrasos> }) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-ink dark:text-white">⏱️ Top atrasos</h3>
        <p className="text-xs text-ink/50 dark:text-white/50">Colaboradores com mais entradas atrasadas.</p>
      </CardHeader>
      <CardBody>
        {dados.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/50 dark:text-white/50">Nenhum atraso no período.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {dados.map((d, i) => (
              <li key={d.colaborador_id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-ink dark:text-white">
                  <span className="text-ink/40 dark:text-white/40">{i + 1}.</span> {d.nome}
                  {d.mediaMinutos != null && (
                    <span className="text-xs text-ink/50 dark:text-white/50"> · média {d.mediaMinutos}min</span>
                  )}
                </span>
                <span className="shrink-0 rounded-full bg-[#FFF3DB] px-2 py-0.5 text-xs font-bold text-[#8A6200]">
                  {d.ocorrencias}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function PainelAbsenteismoLideres({ dados }: { dados: RankingLiderPlanta[] }) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-ink dark:text-white">📉 Maior absenteísmo por líder</h3>
        <p className="text-xs text-ink/50 dark:text-white/50">
          % de dias-pessoa em falta/atestado sobre o time — onde a gestão pode precisar de apoio.
        </p>
      </CardHeader>
      <CardBody>
        {dados.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/50 dark:text-white/50">Sem faltas/atestados no período.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {dados.map((d, i) => (
              <li key={d.lider_id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-ink dark:text-white">
                  <span className="text-ink/40 dark:text-white/40">{i + 1}.</span> {d.lider_nome}
                  <span className="text-xs text-ink/50 dark:text-white/50">
                    {" "}
                    · {d.faltas}F · {d.atestados}A
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-[#FBE7E7] px-2 py-0.5 text-xs font-bold text-danger">
                  {d.taxaAbsenteismo}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function PainelEngajamentoLideres({ dados }: { dados: RankingLiderPlanta[] }) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-ink dark:text-white">🏆 Maior engajamento por líder</h3>
        <p className="text-xs text-ink/50 dark:text-white/50">Média de planta disponível por equipe — benchmark dos melhores.</p>
      </CardHeader>
      <CardBody>
        {dados.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/50 dark:text-white/50">Sem dados de líderes no período.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {dados.map((d, i) => (
              <li key={d.lider_id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-ink dark:text-white">
                  <span className="text-ink/40 dark:text-white/40">{i + 1}.</span> {d.lider_nome}
                </span>
                <span className="shrink-0 rounded-full bg-[#E7F3E8] px-2 py-0.5 text-xs font-bold text-[#2E7D32]">
                  {d.pctMedio}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function GraficoFaltasAtestados({ serie }: { serie: PontoFaltasAtestados[] }) {
  const max = Math.max(1, ...serie.map((p) => Math.max(p.faltas, p.atestados)));
  return (
    <div className="overflow-x-auto">
      <div className="flex h-40 min-w-[480px] items-end gap-2">
        {serie.map((p) => (
          <div key={p.data} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-32 w-full items-end justify-center gap-0.5">
              <div
                className="w-2.5 rounded-t bg-danger"
                style={{ height: `${p.faltas > 0 ? Math.max((p.faltas / max) * 100, 4) : 2}%` }}
                title={`${p.data}: ${p.faltas} falta(s)`}
              />
              <div
                className="w-2.5 rounded-t bg-[#E0964D]"
                style={{ height: `${p.atestados > 0 ? Math.max((p.atestados / max) * 100, 4) : 2}%` }}
                title={`${p.data}: ${p.atestados} atestado(s)`}
              />
            </div>
            <span className="text-[9px] text-ink/40 dark:text-white/40">
              {new Date(`${p.data}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-ink/60 dark:text-white/60">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-danger" /> Faltas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#E0964D]" /> Atestados
        </span>
      </div>
    </div>
  );
}
