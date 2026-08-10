import { useEffect, useMemo, useState } from "react";
import { BrandHeader } from "@/components/layout/BrandHeader";
import { NavPaineis } from "@/components/layout/NavPaineis";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { MetricCard } from "@/components/ui/MetricCard";
import { PresenceMap } from "@/components/presenca/PresenceMap";
import { PendenteLancarCard } from "@/components/presenca/PendenteLancarCard";
import { PendenciasPainel } from "@/components/presenca/PendenciasPainel";
import { StatusActionMenu } from "@/components/presenca/StatusActionMenu";
import { RankingSlaStatusDia } from "@/components/presenca/RankingSlaStatusDia";
import { RelatoriosExport } from "@/components/presenca/RelatoriosExport";
import { TabelaGeralStatus } from "@/components/presenca/TabelaGeralStatus";
import { useAuth } from "@/providers/AuthProvider";
import { hojeISO } from "@/lib/calendario";
import { listarRankingLideres } from "@/services/coordenacaoService";
import * as statusDiaService from "@/services/statusDiaService";
import { listarMapaOperacional } from "@/services/mapaOperacionalService";
import { contarColaboradoresAtivos } from "@/services/colaboradoresService";
import { listarSlaStatusDia, mediaDiaria, mediaMensal, ranquearPorLider } from "@/services/slaService";
import type { SlaLider } from "@/types/domain";
import type { MotivoOutros, PontoMapaOperacional, SlaStatusDia, StatusDiaRegistro } from "@/types/status";

export function CoordenadorDashboard() {
  // Papel (admin/coordenador) já validado por <RequireRole> na definição das rotas.
  const { usuario, sair } = useAuth();
  const [ranking, setRanking] = useState<SlaLider[]>([]);
  const [dataPendencias, setDataPendencias] = useState(hojeISO());
  const [statusDoDia, setStatusDoDia] = useState<StatusDiaRegistro[]>([]);
  const [carregandoPendencias, setCarregandoPendencias] = useState(true);
  const [dataMapa, setDataMapa] = useState(hojeISO());
  const [pontosMapa, setPontosMapa] = useState<PontoMapaOperacional[]>([]);
  const [carregandoMapa, setCarregandoMapa] = useState(true);
  const [decisoesSla, setDecisoesSla] = useState<SlaStatusDia[]>([]);
  const [escalados, setEscalados] = useState(0);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [buscaNome, setBuscaNome] = useState("");

  async function carregar(silencioso = false) {
    if (!silencioso) setCarregandoDados(true);
    setErro(null);
    try {
      const trintaDiasAtras = new Date();
      trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
      const [rank, sla, totalEscalados] = await Promise.all([
        listarRankingLideres(),
        listarSlaStatusDia(trintaDiasAtras.toISOString().slice(0, 10)),
        contarColaboradoresAtivos(),
      ]);
      setRanking(rank);
      setDecisoesSla(sla);
      setEscalados(totalEscalados);
    } catch {
      setErro("Não foi possível carregar os dados do dashboard.");
    } finally {
      if (!silencioso) setCarregandoDados(false);
    }
  }

  async function carregarMapa(silencioso = false) {
    if (!silencioso) setCarregandoMapa(true);
    try {
      setPontosMapa(await listarMapaOperacional(dataMapa));
    } catch {
      setErro("Não foi possível carregar o mapa operacional.");
    } finally {
      if (!silencioso) setCarregandoMapa(false);
    }
  }

  async function carregarPendencias(silencioso = false) {
    if (!silencioso) setCarregandoPendencias(true);
    try {
      setStatusDoDia(await statusDiaService.listarStatusDia(dataPendencias));
    } catch {
      setErro("Não foi possível carregar as pendências.");
    } finally {
      if (!silencioso) setCarregandoPendencias(false);
    }
  }

  async function aplicarEventoStatusDia(
    row: StatusDiaRegistro,
    executar: () => Promise<StatusDiaRegistro>
  ) {
    const atualizado = await executar();
    // A RPC no banco retorna só a linha crua de status_dia (sem os campos de JOIN,
    // ex.: colaborador_nome) — preserva o que já temos e sobrescreve só o que mudou.
    setStatusDoDia((prev) => prev.map((item) => (item.id === row.id ? { ...item, ...atualizado } : item)));
  }

  useEffect(() => {
    if (usuario) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  useEffect(() => {
    if (usuario) carregarMapa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, dataMapa]);

  useEffect(() => {
    if (usuario) carregarPendencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, dataPendencias]);

  // Atualiza os dados sozinho a cada 1 min, sem precisar de F5 — silencioso
  // (não reexibe o spinner de carregamento por cima da tela). Mapa e
  // pendências só atualizam sozinhos quando a data selecionada é hoje —
  // olhar um dia anterior não muda com o tempo.
  useEffect(() => {
    if (!usuario) return;
    const intervalo = setInterval(() => {
      carregar(true);
      if (dataMapa === hojeISO()) carregarMapa(true);
      if (dataPendencias === hojeISO()) carregarPendencias(true);
    }, 60_000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, dataMapa, dataPendencias]);

  const metricas = useMemo(() => {
    const presentes = statusDoDia.filter((s) => s.status === "PRESENTE").length;
    const pendentes = statusDoDia.filter((s) => s.status === "PENDENTE").length;
    // Não planejadas: falta/atestado — impacto operacional imediato.
    const naoPlanejadas = statusDoDia.filter((s) => s.status === "FALTA" || s.status === "ATESTADO").length;
    // Planejadas: folga/outros (férias, banco de horas etc. entram como OUTROS).
    const planejadas = statusDoDia.filter((s) => s.status === "FOLGA" || s.status === "OUTROS").length;
    const percentualDisponivel = escalados > 0 ? Math.round((presentes / escalados) * 100) : 0;
    const slaMedio =
      ranking.length > 0
        ? Math.round(
            (ranking.reduce((soma, l) => soma + (l.pct_dentro_sla ?? 0), 0) / ranking.length) * 10
          ) / 10
        : null;
    return { presentes, pendentes, naoPlanejadas, planejadas, percentualDisponivel, slaMedio };
  }, [statusDoDia, ranking, escalados]);

  const rankingSla = useMemo(() => ranquearPorLider(decisoesSla), [decisoesSla]);
  const mediaGeralMin = useMemo(() => {
    if (decisoesSla.length === 0) return null;
    return Math.round((decisoesSla.reduce((soma, d) => soma + d.minutos, 0) / decisoesSla.length) * 10) / 10;
  }, [decisoesSla]);
  const mediaMesAtualMin = useMemo(() => {
    const mesAtual = hojeISO().slice(0, 7);
    const doMes = mediaMensal(decisoesSla).find((m) => m.mes === mesAtual);
    return doMes?.media_min ?? null;
  }, [decisoesSla]);
  const mediasDiariasRecentes = useMemo(() => mediaDiaria(decisoesSla).slice(0, 7), [decisoesSla]);

  if (!usuario) return null; // narrowing de tipo; na prática nunca alcançado (ver RequireRole)

  const ehAuditor = usuario.perfil === "auditor";

  return (
    <div className="min-h-screen bg-surface dark:bg-[#1A1A1A]">
      <BrandHeader
        title="Painel de coordenação"
        subtitle="Visão consolidada de todas as filiais"
        right={<NavPaineis perfil={usuario.perfil} atual="coordenador" onSair={sair} />}
      />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        {erro && (
          <div className="mb-4">
            <Alert variant="danger">{erro}</Alert>
          </div>
        )}

        {dataPendencias !== hojeISO() && (
          <div className="mb-3">
            <Alert variant="warning">
              Os cards abaixo e o painel de pendências estão mostrando{" "}
              {new Date(`${dataPendencias}T00:00:00`).toLocaleDateString("pt-BR")}, não hoje — mude a data em
              "Pendências e cobrança" pra voltar.
            </Alert>
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard
            label="Efetivo escalado"
            valor={String(escalados)}
            tooltip="Total de colaboradores ativos esperados hoje, em todas as filiais."
            destaque="neutral"
          />
          <MetricCard
            label="Planta disponível"
            valor={`${metricas.percentualDisponivel}%`}
            subtitulo={`${metricas.presentes}/${escalados} presentes`}
            tooltip="Presentes hoje sobre o total do efetivo escalado."
            destaque="primary"
          />
          <MetricCard
            label="Ausências não planejadas"
            valor={String(metricas.naoPlanejadas)}
            tooltip="Falta + Atestado — impacto operacional imediato, exige remanejamento."
            destaque="danger"
          />
          <MetricCard
            label="Ausências planejadas"
            valor={String(metricas.planejadas)}
            tooltip="Folga + férias/banco de horas/outros motivos já previstos."
            destaque="neutral"
          />
          <MetricCard
            label="Gestão de ponto & SLA"
            valor={String(metricas.pendentes)}
            subtitulo={metricas.slaMedio != null ? `SLA médio ${metricas.slaMedio}%` : "SLA médio —"}
            tooltip="Pendências de aprovação dos líderes e o SLA médio de atendimento."
            destaque="warning"
          />
        </div>

        <div className="mb-6">
          <PendenteLancarCard itens={statusDoDia} />
        </div>

        <Card className="mb-6">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-ink dark:text-white">Mapa operacional</h2>
              <p className="text-xs text-ink/50 dark:text-white/50">
                Status do dia de cada colaborador, com localização quando disponível. A busca por nome é a mesma do
                painel de pendências, mais abaixo.
              </p>
            </div>
            <input
              type="date"
              value={dataMapa}
              max={hojeISO()}
              onChange={(e) => setDataMapa(e.target.value)}
              className="h-10 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
            />
          </CardHeader>
          <CardBody>
            {carregandoMapa ? (
              <MapaCarregando />
            ) : (
              <PresenceMap pontos={pontosMapa} filtroNomeExterno={buscaNome} />
            )}
          </CardBody>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink dark:text-white">Geral — nome e status</h2>
            <p className="text-xs text-ink/50 dark:text-white/50">
              Consulte qualquer dia, filtrando por status e nome. A data é a mesma do Mapa operacional, acima.
            </p>
          </CardHeader>
          <CardBody>
            <TabelaGeralStatus data={dataMapa} onDataChange={setDataMapa} />
          </CardBody>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink dark:text-white">Exportações</h2>
            <p className="text-xs text-ink/50 dark:text-white/50">Relatórios de presença, pendências, rejeições e auditoria.</p>
          </CardHeader>
          <CardBody>
            <RelatoriosExport />
          </CardBody>
        </Card>

        <Card className="mb-6">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-ink dark:text-white">Pendências e cobrança</h2>
              <p className="text-xs text-ink/50 dark:text-white/50">
                Status do dia de todos os colaboradores, todas as filiais. Escolha uma data anterior se precisar
                corrigir o status de um dia passado.
              </p>
            </div>
            <input
              type="date"
              value={dataPendencias}
              max={hojeISO()}
              onChange={(e) => setDataPendencias(e.target.value)}
              className="h-10 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
            />
          </CardHeader>
          <CardBody>
            {carregandoPendencias ? (
              <div className="flex justify-center py-8">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <PendenciasPainel
                itens={statusDoDia}
                busca={buscaNome}
                onBuscaChange={setBuscaNome}
                renderAcoes={
                  ehAuditor
                    ? undefined
                    : (row) => (
                        <StatusActionMenu
                          nome={row.colaborador_nome ?? "Colaborador"}
                          statusAtual={row.status}
                          pedirConfirmacao
                          onAprovar={() =>
                            aplicarEventoStatusDia(row, () =>
                              statusDiaService.aplicarEvento(row, { tipo: "APROVAR" })
                            )
                          }
                          onRejeitar={() =>
                            aplicarEventoStatusDia(row, () =>
                              statusDiaService.aplicarEvento(row, { tipo: "REJEITAR" })
                            )
                          }
                          onMarcarManual={(status, opts) =>
                            aplicarEventoStatusDia(row, () =>
                              statusDiaService.aplicarEvento(row, {
                                tipo: "MARCAR_MANUAL",
                                status,
                                motivoOutros: opts?.motivoOutros as MotivoOutros | undefined,
                                observacao: opts?.observacao,
                              })
                            )
                          }
                        />
                      )
                }
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink dark:text-white">SLA de aprovação — status do dia</h2>
            <p className="text-xs text-ink/50 dark:text-white/50">
              Tempo entre o envio da presença (PENDENTE) e a decisão do líder. Verde ≤15min, amarelo 15-30min,
              vermelho &gt;30min.
            </p>
          </CardHeader>
          <CardBody className="flex flex-col gap-5">
            {carregandoDados ? (
              <div className="flex justify-center py-8">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <>
                <RankingSlaStatusDia
                  ranking={rankingSla}
                  mediaGeralMin={mediaGeralMin}
                  mediaMesAtualMin={mediaMesAtualMin}
                />
                {mediasDiariasRecentes.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-ink/60 dark:text-white/60">Últimos dias</p>
                    <div className="flex flex-wrap gap-2">
                      {mediasDiariasRecentes.map((m) => (
                        <div key={m.data} className="rounded-md border border-ink/10 px-3 py-1.5 text-xs">
                          <span className="text-ink/50 dark:text-white/50">
                            {new Date(m.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                          </span>{" "}
                          <span className="font-semibold text-ink dark:text-white">{m.media_min} min</span>{" "}
                          <span className="text-ink/40 dark:text-white/40">({m.total})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>
      </main>
    </div>
  );
}

function MapaCarregando() {
  return (
    <div className="flex h-[420px] items-center justify-center rounded-lg border border-ink/10 bg-surface">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
