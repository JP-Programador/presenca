import { useEffect, useMemo, useState } from "react";
import { BrandHeader } from "@/components/layout/BrandHeader";
import { NavPaineis } from "@/components/layout/NavPaineis";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { MetricCard } from "@/components/ui/MetricCard";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { PresenceMap } from "@/components/presenca/PresenceMap";
import { RankingLideres } from "@/components/presenca/RankingLideres";
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
import { listarSlaStatusDia, mediaDiaria, mediaMensal, ranquearPorLider } from "@/services/slaService";
import type { SlaLider } from "@/types/domain";
import type { MotivoOutros, PontoMapaOperacional, SlaStatusDia, StatusDiaRegistro } from "@/types/status";

export function CoordenadorDashboard() {
  // Papel (admin/coordenador) já validado por <RequireRole> na definição das rotas.
  const { usuario, sair } = useAuth();
  const [ranking, setRanking] = useState<SlaLider[]>([]);
  const [statusDoDia, setStatusDoDia] = useState<StatusDiaRegistro[]>([]);
  const [pontosMapa, setPontosMapa] = useState<PontoMapaOperacional[]>([]);
  const [decisoesSla, setDecisoesSla] = useState<SlaStatusDia[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [buscaNome, setBuscaNome] = useState("");

  async function carregar() {
    setCarregandoDados(true);
    setErro(null);
    try {
      const trintaDiasAtras = new Date();
      trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
      const [rank, statusDia, pontos, sla] = await Promise.all([
        listarRankingLideres(),
        statusDiaService.listarStatusDia(hojeISO()),
        listarMapaOperacional(hojeISO()),
        listarSlaStatusDia(trintaDiasAtras.toISOString().slice(0, 10)),
      ]);
      setRanking(rank);
      setStatusDoDia(statusDia);
      setPontosMapa(pontos);
      setDecisoesSla(sla);
    } catch {
      setErro("Não foi possível carregar os dados do dashboard.");
    } finally {
      setCarregandoDados(false);
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

  const metricas = useMemo(() => {
    const presentes = statusDoDia.filter((s) => s.status === "PRESENTE").length;
    const pendentes = statusDoDia.filter((s) => s.status === "PENDENTE").length;
    const faltas = statusDoDia.filter((s) => s.status === "FALTA").length;
    // "Ausentes" = todo mundo que não está presente nem aguardando aprovação
    // (falta + atestado + folga + outros) — visão consolidada do dia.
    const ausentes = statusDoDia.filter((s) => s.status !== "PRESENTE" && s.status !== "PENDENTE").length;
    const slaMedio =
      ranking.length > 0
        ? Math.round(
            (ranking.reduce((soma, l) => soma + (l.pct_dentro_sla ?? 0), 0) / ranking.length) * 10
          ) / 10
        : null;
    return { presentes, pendentes, faltas, ausentes, slaMedio };
  }, [statusDoDia, ranking]);

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

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard label="Presentes hoje" valor={String(metricas.presentes)} destaque="primary" />
          <MetricCard label="Faltas hoje" valor={String(metricas.faltas)} destaque="danger" />
          <MetricCard label="Ausentes (falta+atestado+folga+outros)" valor={String(metricas.ausentes)} destaque="danger" />
          <MetricCard label="Pendentes de aprovação" valor={String(metricas.pendentes)} destaque="warning" />
          <MetricCard
            label="SLA médio dos líderes"
            valor={metricas.slaMedio != null ? `${metricas.slaMedio}%` : "—"}
            destaque="primary"
          />
        </div>

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
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink dark:text-white">Mapa operacional (hoje)</h2>
            <p className="text-xs text-ink/50 dark:text-white/50">
              Status do dia de cada colaborador, com localização quando disponível. A busca por nome é a mesma do
              painel de pendências, mais abaixo.
            </p>
          </CardHeader>
          <CardBody>
            {carregandoDados ? (
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
              Consulte qualquer dia, filtrando por status e nome.
            </p>
          </CardHeader>
          <CardBody>
            <TabelaGeralStatus />
          </CardBody>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink dark:text-white">Pendências e cobrança</h2>
            <p className="text-xs text-ink/50 dark:text-white/50">Status do dia de todos os colaboradores, todas as filiais.</p>
          </CardHeader>
          <CardBody>
            {carregandoDados ? (
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

        <Card className="mb-6">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-ink dark:text-white">Ranking de líderes</h2>
              <p className="text-xs text-ink/50 dark:text-white/50">Ordenado por % de decisões dentro do SLA de 2h.</p>
            </div>
            <ExportButtons
              dados={ranking}
              nomeBase="ranking-lideres"
              colunas={[
                { chave: "gestor_nome", titulo: "Líder" },
                { chave: "filial_home_nome", titulo: "Filial" },
                { chave: "total_decisoes", titulo: "Decisões" },
                { chave: "total_aprovadas", titulo: "Aprovadas" },
                { chave: "total_rejeitadas", titulo: "Rejeitadas" },
                { chave: "tempo_medio_min", titulo: "Tempo médio (min)" },
                { chave: "pct_dentro_sla", titulo: "% dentro do SLA" },
                { chave: "pendencias_atuais", titulo: "Pendências atuais" },
              ]}
            />
          </CardHeader>
          <CardBody>
            {carregandoDados ? (
              <div className="flex justify-center py-8">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <RankingLideres dados={ranking} />
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
