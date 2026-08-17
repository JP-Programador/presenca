import { useEffect, useMemo, useState } from "react";
import { BrandHeader } from "@/components/layout/BrandHeader";
import { NavPaineis } from "@/components/layout/NavPaineis";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useAuth } from "@/providers/AuthProvider";
import { hojeISO, intervaloDeDatas } from "@/lib/calendario";
import * as statusDiaService from "@/services/statusDiaService";
import { listarColaboradores } from "@/services/colaboradoresService";
import { listarLideres, type PessoaSimples } from "@/services/coordenacaoService";
import { listarMapaOperacionalPeriodo } from "@/services/mapaOperacionalService";
import { PresenceMap } from "@/components/presenca/PresenceMap";
import {
  listarHorariosEntrada,
  listarRegistrosAtrasados,
  listarRegistrosEntradaPeriodo,
} from "@/services/dashboardPresencaService";
import { exportarCSV } from "@/services/exportService";
import { AnalyticsMensal } from "@/components/presenca/AnalyticsMensal";
import {
  calcularAcumuladoPeriodo,
  calcularTopFaltas,
  calcularTopAtrasos,
  calcularSerieDiaria,
  calcularSerieFaltasAtestados,
  montarLinhasDetalhadas,
  mapearLideres,
  calcularRankingPorLider,
  META_PLANTA_DISPONIVEL,
  type PontoDiario,
  type PontoFaltasAtestados,
  type RankingLiderPlanta,
  type LinhaDetalhada,
} from "@/lib/analytics";
import type { PontoMapaOperacional, StatusDiaRegistro } from "@/types/status";
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

export function DashboardPresenca() {
  // Papel (admin/auditor/coordenador/gestor) já validado por <RequireRole> na definição das rotas.
  const { usuario, sair } = useAuth();
  const ehLider = usuario?.perfil === "gestor";

  const [periodo, setPeriodo] = useState<PeriodoGlobal>("semana");
  const [personalizadoInicio, setPersonalizadoInicio] = useState(inicioDoPeriodo("30dias"));
  const [personalizadoFim, setPersonalizadoFim] = useState(hojeISO());
  const [liderFiltro, setLiderFiltro] = useState<string>("todos");
  const [colaboradorFiltro, setColaboradorFiltro] = useState<string>("todos");

  const { inicio, fim } = useMemo(() => {
    if (periodo === "personalizado") {
      return personalizadoInicio <= personalizadoFim
        ? { inicio: personalizadoInicio, fim: personalizadoFim }
        : { inicio: personalizadoFim, fim: personalizadoInicio };
    }
    return { inicio: inicioDoPeriodo(periodo), fim: hojeISO() };
  }, [periodo, personalizadoInicio, personalizadoFim]);

  const [statusPeriodoTodos, setStatusPeriodoTodos] = useState<StatusDiaRegistro[]>([]);
  const [registrosAtrasadosTodos, setRegistrosAtrasadosTodos] = useState<RegistroPresenca[]>([]);
  const [registrosEntradaTodos, setRegistrosEntradaTodos] = useState<RegistroPresenca[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [lideresDisponiveis, setLideresDisponiveis] = useState<PessoaSimples[]>([]);
  const [horariosEntrada, setHorariosEntrada] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [pontosMapaColaborador, setPontosMapaColaborador] = useState<PontoMapaOperacional[]>([]);
  const [carregandoMapaColaborador, setCarregandoMapaColaborador] = useState(false);

  const diasConsiderados = useMemo(() => intervaloDeDatas(inicio, fim).length, [inicio, fim]);

  async function carregar(silencioso = false) {
    if (!silencioso) setCarregando(true);
    setErro(null);
    try {
      const [statusDia, atrasados, entradas, colabs, lideres, horarios] = await Promise.all([
        statusDiaService.listarStatusDiaPeriodo(inicio, fim),
        listarRegistrosAtrasados(inicio, fim),
        listarRegistrosEntradaPeriodo(inicio, fim),
        listarColaboradores(),
        ehLider ? Promise.resolve<PessoaSimples[]>([]) : listarLideres(),
        listarHorariosEntrada(hojeISO()),
      ]);
      setStatusPeriodoTodos(statusDia);
      setRegistrosAtrasadosTodos(atrasados);
      setRegistrosEntradaTodos(entradas);
      setColaboradores(colabs);
      setLideresDisponiveis(lideres);
      setHorariosEntrada(horarios);
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

  // Filtro em cascata: líder -> colaborador. Pra líder logado, os dados já
  // vêm restritos à própria equipe via RLS — o filtro de líder nem
  // aparece pra ele (fica travado no próprio nome); só o de colaborador
  // continua útil, dentro do time dele.
  const colaboradoresDoLider = useMemo(
    () => (liderFiltro === "todos" ? colaboradores : colaboradores.filter((c) => c.lider_id === liderFiltro)),
    [colaboradores, liderFiltro]
  );

  const colaboradoresVisiveis = useMemo(
    () =>
      colaboradorFiltro === "todos"
        ? colaboradoresDoLider
        : colaboradoresDoLider.filter((c) => c.id === colaboradorFiltro),
    [colaboradoresDoLider, colaboradorFiltro]
  );

  const colaboradorSelecionado = useMemo(
    () => (colaboradorFiltro === "todos" ? null : colaboradores.find((c) => c.id === colaboradorFiltro) ?? null),
    [colaboradores, colaboradorFiltro]
  );

  // Trilha de marcações de um colaborador específico no mapa — só busca (e só
  // mostra) quando um colaborador está filtrado, pra não poluir a tela.
  useEffect(() => {
    if (colaboradorFiltro === "todos") {
      setPontosMapaColaborador([]);
      return;
    }
    setCarregandoMapaColaborador(true);
    listarMapaOperacionalPeriodo(inicio, fim, colaboradorFiltro)
      .then(setPontosMapaColaborador)
      .catch(() => setPontosMapaColaborador([]))
      .finally(() => setCarregandoMapaColaborador(false));
  }, [colaboradorFiltro, inicio, fim]);

  const idsVisiveis = useMemo(() => new Set(colaboradoresVisiveis.map((c) => c.id)), [colaboradoresVisiveis]);
  const escalados = useMemo(() => colaboradoresVisiveis.filter((c) => c.ativo).length, [colaboradoresVisiveis]);

  const statusPeriodo = useMemo(
    () => statusPeriodoTodos.filter((s) => idsVisiveis.has(s.colaborador_id)),
    [statusPeriodoTodos, idsVisiveis]
  );
  const registrosAtrasados = useMemo(
    () => registrosAtrasadosTodos.filter((r) => idsVisiveis.has(r.colaborador_id)),
    [registrosAtrasadosTodos, idsVisiveis]
  );
  const registrosEntrada = useMemo(
    () => registrosEntradaTodos.filter((r) => idsVisiveis.has(r.colaborador_id)),
    [registrosEntradaTodos, idsVisiveis]
  );

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

  const serieDiaria = useMemo<PontoDiario[]>(
    () => calcularSerieDiaria(statusPeriodo, escalados, inicio, fim),
    [statusPeriodo, escalados, inicio, fim]
  );

  const serieFaltasAtestados = useMemo<PontoFaltasAtestados[]>(
    () => calcularSerieFaltasAtestados(statusPeriodo, inicio, fim),
    [statusPeriodo, inicio, fim]
  );

  const linhasDetalhadas = useMemo<LinhaDetalhada[]>(
    () => montarLinhasDetalhadas(statusPeriodo, registrosEntrada, mapaLideres),
    [statusPeriodo, registrosEntrada, mapaLideres]
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

  function exportarDetalhado() {
    exportarCSV(
      linhasDetalhadas.map((l) => ({
        data: l.data,
        colaborador: l.colaborador_nome,
        lider: l.lider_nome,
        status: STATUS_LABEL[l.status] ?? l.status,
        horario_entrada: l.horarioEntrada ?? "",
        minutos_atraso: l.minutosAtraso ?? "",
      })),
      [
        { chave: "data", titulo: "Data" },
        { chave: "colaborador", titulo: "Colaborador" },
        { chave: "lider", titulo: "Líder direto" },
        { chave: "status", titulo: "Status" },
        { chave: "horario_entrada", titulo: "Horário de entrada" },
        { chave: "minutos_atraso", titulo: "Minutos de atraso" },
      ],
      `presenca-detalhado-${inicio}-a-${fim}.csv`
    );
  }

  if (!usuario) return null; // narrowing de tipo; na prática nunca alcançado (ver RequireRole)

  const periodoLabel = PERIODOS_GLOBAIS.find((p) => p.chave === periodo)?.label ?? "";

  return (
    <div className="min-h-screen bg-surface dark:bg-[#1A1A1A]">
      <BrandHeader
        title="Dashboard de presença"
        subtitle={ehLider ? "Visão acumulada da sua equipe" : "Visão acumulada de todas as filiais"}
        right={<NavPaineis perfil={usuario.perfil} atual="dashboard-presenca" onSair={sair} />}
      />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
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

          <div className="flex flex-wrap items-center gap-2">
            {ehLider ? (
              <span className="rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-semibold text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white">
                Líder: {usuario.nome}
              </span>
            ) : (
              <select
                value={liderFiltro}
                onChange={(e) => {
                  setLiderFiltro(e.target.value);
                  setColaboradorFiltro("todos");
                }}
                className="h-10 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
              >
                <option value="todos">Todos os líderes</option>
                {lideresDisponiveis.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            )}
            <select
              value={colaboradorFiltro}
              onChange={(e) => setColaboradorFiltro(e.target.value)}
              className="h-10 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
            >
              <option value="todos">Todos os colaboradores</option>
              {colaboradoresDoLider.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {erro && (
          <div className="mb-4">
            <Alert variant="danger">{erro}</Alert>
          </div>
        )}

        {colaboradorSelecionado && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-sm font-semibold text-ink dark:text-white">
                Trilha de marcações — {colaboradorSelecionado.nome}
              </h2>
              <p className="text-xs text-ink/50 dark:text-white/50">
                Check-ins de presença no período selecionado
                {colaboradorSelecionado.latitude != null ? " e a residência cadastrada (🏠)." : "."}
              </p>
            </CardHeader>
            <CardBody>
              {carregandoMapaColaborador ? (
                <div className="flex justify-center py-10">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : (
                <PresenceMap
                  pontos={pontosMapaColaborador}
                  somenteExibicao
                  altura={360}
                  casaColaborador={
                    colaboradorSelecionado.latitude != null && colaboradorSelecionado.longitude != null
                      ? { latitude: colaboradorSelecionado.latitude, longitude: colaboradorSelecionado.longitude }
                      : null
                  }
                />
              )}
            </CardBody>
          </Card>
        )}

        {carregando ? (
          <div className="flex justify-center py-16">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                <h2 className="text-sm font-semibold text-ink dark:text-white">Evolução diária da planta ativa</h2>
                <p className="text-xs text-ink/50 dark:text-white/50">
                  Quantidade absoluta de presentes por dia (linha tracejada = efetivo escalado atual: {escalados}).
                </p>
              </CardHeader>
              <CardBody>
                {serieDiaria.length === 0 ? (
                  <p className="py-10 text-center text-sm text-ink/50 dark:text-white/50">Sem dados nesse período.</p>
                ) : (
                  <GraficoPlantaAtiva serie={serieDiaria} escalados={escalados} />
                )}
              </CardBody>
            </Card>

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
              <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-ink dark:text-white">Detalhado do período</h2>
                  <p className="text-xs text-ink/50 dark:text-white/50">
                    Uma linha por colaborador/dia — {linhasDetalhadas.length} registro(s).
                  </p>
                </div>
                <Button variant="secondary" size="md" onClick={exportarDetalhado} disabled={linhasDetalhadas.length === 0}>
                  Exportar CSV
                </Button>
              </CardHeader>
              <CardBody>
                {linhasDetalhadas.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink/50 dark:text-white/50">Nenhum dado nesse período.</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto overflow-x-auto rounded-lg border border-ink/10 dark:border-white/10">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-ink/10 bg-surface text-xs uppercase tracking-wide text-ink/50 dark:border-white/10 dark:bg-[#1A1A1A] dark:text-white/50">
                          <th className="px-3 py-2">Data</th>
                          <th className="px-3 py-2">Colaborador</th>
                          <th className="px-3 py-2">Líder direto</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2 text-right">Entrada</th>
                          <th className="px-3 py-2 text-right">Atraso (min)</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-[#242424]">
                        {linhasDetalhadas.map((l, i) => (
                          <tr key={i} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                            <td className="px-3 py-2 text-ink/70 dark:text-white/70">
                              {new Date(`${l.data}T00:00:00`).toLocaleDateString("pt-BR")}
                            </td>
                            <td className="px-3 py-2 font-medium text-ink dark:text-white">{l.colaborador_nome}</td>
                            <td className="px-3 py-2 text-ink/70 dark:text-white/70">{l.lider_nome}</td>
                            <td className="px-3 py-2 text-ink/70 dark:text-white/70">
                              {STATUS_LABEL[l.status] ?? l.status}
                            </td>
                            <td className="px-3 py-2 text-right text-ink/70 dark:text-white/70">
                              {l.horarioEntrada ?? "—"}
                            </td>
                            <td className={["px-3 py-2 text-right", (l.minutosAtraso ?? 0) > 0 ? "text-warning font-semibold" : "text-ink/40 dark:text-white/40"].join(" ")}>
                              {l.minutosAtraso ?? "—"}
                            </td>
                          </tr>
                        ))}
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

const STATUS_LABEL: Record<string, string> = {
  PRESENTE: "Presente",
  FALTA: "Falta",
  ATESTADO: "Atestado",
  FOLGA: "Folga",
  PENDENTE: "Pendente",
  OUTROS: "Outros",
};

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

function GraficoPlantaAtiva({ serie, escalados }: { serie: PontoDiario[]; escalados: number }) {
  const largura = 700;
  const altura = 160;
  const max = Math.max(escalados, 1, ...serie.map((p) => p.presentes));
  const passoX = serie.length > 1 ? largura / (serie.length - 1) : 0;

  const pontos = serie.map((p, i) => ({ x: i * passoX, y: altura - (p.presentes / max) * altura, p }));
  const linha = pontos.map((pt) => `${pt.x},${pt.y}`).join(" ");
  const yEscalados = altura - (escalados / max) * altura;

  const mostrarTodasDatas = serie.length <= 15;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${largura} ${altura + 24}`} className="h-48 w-full min-w-[500px]">
        <line x1={0} y1={yEscalados} x2={largura} y2={yEscalados} stroke="#8A6200" strokeWidth={1} strokeDasharray="4 3" />
        <text x={largura - 2} y={yEscalados - 4} textAnchor="end" fontSize={10} fill="#8A6200">
          Escalados ({escalados})
        </text>
        <polyline points={linha} fill="none" strokeWidth={2} className="stroke-primary" />
        {pontos.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r={2.5} className="fill-primary">
            <title>
              {pt.p.data}: {pt.p.presentes} presentes
            </title>
          </circle>
        ))}
        {pontos.map((pt, i) => {
          if (!mostrarTodasDatas && i % Math.ceil(serie.length / 10) !== 0 && i !== serie.length - 1) return null;
          return (
            <text
              key={`label-${i}`}
              x={pt.x}
              y={altura + 16}
              textAnchor="middle"
              fontSize={9}
              className="fill-ink/40 dark:fill-white/40"
            >
              {new Date(`${pt.p.data}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
            </text>
          );
        })}
      </svg>
    </div>
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
