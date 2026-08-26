import { useEffect, useMemo, useState } from "react";
import { BrandHeader } from "@/components/layout/BrandHeader";
import { NavPaineis } from "@/components/layout/NavPaineis";
import { Alert } from "@/components/ui/Alert";
import { MetricCard } from "@/components/ui/MetricCard";
import { PendenteLancarCard } from "@/components/presenca/PendenteLancarCard";
import { StatusActionMenu } from "@/components/presenca/StatusActionMenu";
import { AlertasCard } from "@/components/presenca/AlertasCard";
import { AtendimentoConfigToggle } from "@/components/presenca/AtendimentoConfigToggle";
import { AtendimentosPendentesPainel } from "@/components/presenca/AtendimentosPendentesPainel";
import { TabelaMarcacoes } from "@/components/presenca/TabelaMarcacoes";
import { TabelaCheckinsPertoCasa } from "@/components/presenca/TabelaCheckinsPertoCasa";
import { PendenciasPainel } from "@/components/presenca/PendenciasPainel";
import { PresenceMap } from "@/components/presenca/PresenceMap";
import { AcoesPopupMapa } from "@/components/presenca/AcoesPopupMapa";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { TabelaGeralStatus } from "@/components/presenca/TabelaGeralStatus";
import { SeletorPeriodoMapa, type ModoMapa } from "@/components/presenca/SeletorPeriodoMapa";
import { useAuth } from "@/providers/AuthProvider";
import { hojeISO, mesAtualISO, intervaloDoMes } from "@/lib/calendario";
import * as statusDiaService from "@/services/statusDiaService";
import { listarMapaOperacional, listarMapaOperacionalPeriodo } from "@/services/mapaOperacionalService";
import { contarColaboradoresAtivos } from "@/services/colaboradoresService";
import { contarIndicadoresJornada, type IndicadoresJornada } from "@/services/relatoriosService";
import type { MotivoOutros, PontoMapaOperacional, StatusDiaRegistro } from "@/types/status";

type Aba = "status_dia" | "geral";

export function LiderDashboard() {
  // Papel (admin/auditor/coordenador/gestor) já validado por <RequireRole> na definição das rotas.
  const { usuario, sair } = useAuth();
  const [aba, setAba] = useState<Aba>("status_dia");
  const [statusDoDia, setStatusDoDia] = useState<StatusDiaRegistro[]>([]);
  const [pontosMapa, setPontosMapa] = useState<PontoMapaOperacional[]>([]);
  const [escalados, setEscalados] = useState(0);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [buscaNome, setBuscaNome] = useState("");
  const [exigeSaidaAtendimento, setExigeSaidaAtendimento] = useState(usuario?.exige_saida_atendimento ?? false);
  const [pontoFoco, setPontoFoco] = useState<{ latitude: number; longitude: number; label?: string } | null>(null);
  const [indicadores, setIndicadores] = useState<IndicadoresJornada | null>(null);
  const [dataPendencias, setDataPendencias] = useState(hojeISO());

  // Mapa da aba "Status do dia": alterna entre "Dia" (snapshot, como sempre
  // foi) e "Mês" (todas as marcações do mês, mesmos filtros de sempre).
  const [modoMapa, setModoMapa] = useState<ModoMapa>("dia");
  const [dataMapa, setDataMapa] = useState(hojeISO());
  const [mesMapa, setMesMapa] = useState(mesAtualISO());
  const [carregandoMapa, setCarregandoMapa] = useState(true);

  // Aba "Geral": data selecionável (não fixa em hoje) e o mapa dessa aba
  // segue a mesma data escolhida na tabela.
  const [dataGeral, setDataGeral] = useState(hojeISO());
  const [pontosMapaGeral, setPontosMapaGeral] = useState<PontoMapaOperacional[]>([]);
  const [carregandoMapaGeral, setCarregandoMapaGeral] = useState(true);

  async function carregar(silencioso = false) {
    if (!silencioso) setCarregandoLista(true);
    setErro(null);
    try {
      const [statusDia, totalEscalados] = await Promise.all([
        statusDiaService.listarStatusDia(dataPendencias),
        contarColaboradoresAtivos(),
      ]);
      setStatusDoDia(statusDia);
      setEscalados(totalEscalados);
    } catch (err) {
      setErro("Não foi possível carregar as pendências. Atualize a página.");
    } finally {
      if (!silencioso) setCarregandoLista(false);
    }
  }

  async function carregarMapa(silencioso = false) {
    if (!silencioso) setCarregandoMapa(true);
    try {
      if (modoMapa === "mes") {
        const { inicio, fim } = intervaloDoMes(mesMapa);
        setPontosMapa(await listarMapaOperacionalPeriodo(inicio, fim));
      } else {
        setPontosMapa(await listarMapaOperacional(dataMapa));
      }
    } catch {
      setErro("Não foi possível carregar o mapa.");
    } finally {
      if (!silencioso) setCarregandoMapa(false);
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

  async function carregarMapaGeral(silencioso = false) {
    if (!silencioso) setCarregandoMapaGeral(true);
    try {
      setPontosMapaGeral(await listarMapaOperacional(dataGeral));
    } catch {
      setErro("Não foi possível carregar o mapa.");
    } finally {
      if (!silencioso) setCarregandoMapaGeral(false);
    }
  }

  useEffect(() => {
    if (usuario) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, dataPendencias]);

  useEffect(() => {
    if (usuario) carregarMapa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, modoMapa, dataMapa, mesMapa]);

  useEffect(() => {
    if (usuario) contarIndicadoresJornada(30).then(setIndicadores).catch(() => {});
  }, [usuario]);

  useEffect(() => {
    if (usuario) carregarMapaGeral();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, dataGeral]);

  // Atualiza os dados sozinho a cada 1 min, sem precisar de F5 — não mostra o
  // spinner de carregamento pra não interromper quem está usando a tela. O
  // mapa da aba Geral só atualiza sozinho quando a data selecionada é hoje.
  useEffect(() => {
    if (!usuario) return;
    const intervalo = setInterval(() => {
      if (dataPendencias === hojeISO()) carregar(true);
      if (modoMapa === "dia" ? dataMapa === hojeISO() : mesMapa === mesAtualISO()) carregarMapa(true);
      if (dataGeral === hojeISO()) carregarMapaGeral(true);
    }, 60_000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, dataPendencias, modoMapa, dataMapa, mesMapa, dataGeral]);

  const metricas = useMemo(() => {
    const presentes = statusDoDia.filter((s) => s.status === "PRESENTE").length;
    const pendentes = statusDoDia.filter((s) => s.status === "PENDENTE").length;
    // Ausência não planejada = falta ou atestado, o que exige remanejamento imediato.
    const faltasAtestados = statusDoDia.filter((s) => s.status === "FALTA" || s.status === "ATESTADO").length;
    const percentualPresenca = escalados > 0 ? Math.round((presentes / escalados) * 100) : 0;
    return { presentes, pendentes, faltasAtestados, percentualPresenca };
  }, [statusDoDia, escalados]);

  if (!usuario) return null; // narrowing de tipo; na prática nunca alcançado (ver RequireAuth)

  const ehAuditor = usuario.perfil === "auditor";
  const ehLiderDireto = usuario.perfil === "gestor";

  return (
    <div className="min-h-screen bg-surface dark:bg-[#1A1A1A]">
      <BrandHeader
        title={`Olá, ${usuario?.nome.split(" ")[0]}`}
        subtitle="Aprovações pendentes da sua filial"
        right={<NavPaineis perfil={usuario.perfil} atual="lider" onSair={sair} />}
      />

      <main className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
        <AlertasCard />

        {ehLiderDireto && (
          <AtendimentoConfigToggle exigeSaidaAtual={exigeSaidaAtendimento} onAtualizado={setExigeSaidaAtendimento} />
        )}

        <AtendimentosPendentesPainel />
        {ehLiderDireto && exigeSaidaAtendimento && <TabelaMarcacoes />}

        <div className="mb-5 grid grid-cols-3 gap-2">
          <MetricCard
            label="Disponibilidade"
            valor={`${metricas.percentualPresenca}%`}
            subtitulo={`${metricas.presentes}/${escalados} presentes`}
            tooltip="Presentes hoje sobre o total de colaboradores ativos do seu time."
            destaque="primary"
          />
          <MetricCard
            label="Faltas/Atestados"
            valor={String(metricas.faltasAtestados)}
            tooltip="Ausências não planejadas (falta ou atestado) — exigem remanejamento imediato."
            destaque="danger"
          />
          <MetricCard
            label="Pendentes"
            valor={String(metricas.pendentes)}
            tooltip="Check-ins aguardando sua aprovação."
            destaque="warning"
          />
        </div>

        {indicadores && (
          <div className="mb-5 grid grid-cols-3 gap-2">
            <MetricCard
              label="Perto de casa"
              valor={String(indicadores.pertoDeCasaColaboradores)}
              tooltip="Colaboradores com check-in perto da residência cadastrada nos últimos 30 dias."
              destaque="warning"
            />
            <MetricCard
              label="Atendimentos +12h"
              valor={String(indicadores.mais12h)}
              tooltip="Marcações de entrada->saída com mais de 12h de duração, últimos 30 dias."
              destaque="danger"
            />
            <MetricCard
              label="Sem interjornada 11h"
              valor={String(indicadores.semInterjornada)}
              tooltip="Menos de 11h de descanso entre turnos, últimos 30 dias."
              destaque="danger"
            />
          </div>
        )}

        <div className="mb-5">
          <PendenteLancarCard itens={statusDoDia} />
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-md bg-white p-1 shadow-sm dark:bg-[#242424] sm:flex">
          <button
            onClick={() => setAba("status_dia")}
            className={[
              "rounded-md px-3 py-2 text-xs font-semibold transition-colors sm:flex-1 sm:text-sm",
              aba === "status_dia" ? "bg-primary text-white" : "text-ink/60 hover:bg-surface dark:hover:bg-white/5",
            ].join(" ")}
          >
            Status do dia ({statusDoDia.length})
          </button>
          <button
            onClick={() => setAba("geral")}
            className={[
              "rounded-md px-3 py-2 text-xs font-semibold transition-colors sm:flex-1 sm:text-sm",
              aba === "geral" ? "bg-primary text-white" : "text-ink/60 hover:bg-surface dark:hover:bg-white/5",
            ].join(" ")}
          >
            Geral
          </button>
        </div>

        {erro && (
          <div className="mb-4">
            <Alert variant="danger">{erro}</Alert>
          </div>
        )}

        {aba === "status_dia" && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink/50 dark:text-white/50">
              Pendências de aprovação de outro dia (ex.: alguém que não lançou ontem) também aparecem aqui.
            </p>
            <input
              type="date"
              value={dataPendencias}
              max={hojeISO()}
              onChange={(e) => setDataPendencias(e.target.value)}
              className="h-10 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
            />
          </div>
        )}

        {aba === "status_dia" && dataPendencias !== hojeISO() && (
          <div className="mb-4">
            <Alert variant="warning">
              Os cards e a lista abaixo estão mostrando{" "}
              {new Date(`${dataPendencias}T00:00:00`).toLocaleDateString("pt-BR")}, não hoje — mude a data acima pra
              voltar.
            </Alert>
          </div>
        )}

        {carregandoLista ? (
          <div className="flex justify-center py-12">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {aba === "status_dia" && (
              <div className="mb-4 flex flex-col gap-4">
                <Card>
                  <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-ink dark:text-white">Mapa da equipe</h2>
                      <p className="text-xs text-ink/50 dark:text-white/50">
                        Clique numa marcação pendente pra aprovar ou rejeitar direto por aqui. Filtre por
                        colaborador pra ver todas as marcações dele no período e a residência cadastrada (🏠).
                      </p>
                    </div>
                    <SeletorPeriodoMapa
                      modo={modoMapa}
                      onModoChange={setModoMapa}
                      data={dataMapa}
                      onDataChange={setDataMapa}
                      mes={mesMapa}
                      onMesChange={setMesMapa}
                    />
                  </CardHeader>
                  <CardBody>
                    {carregandoMapa ? (
                      <div className="flex h-[320px] items-center justify-center rounded-lg border border-ink/10 bg-surface">
                        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    ) : (
                      <PresenceMap
                        pontos={pontosMapa}
                        filtroNomeExterno={buscaNome}
                        pontoFoco={pontoFoco}
                        altura={320}
                        renderAcoesPopup={
                          ehAuditor
                            ? undefined
                            : (ponto) => {
                                const row = statusDoDia.find((s) => s.id === ponto.status_dia_id);
                                if (!row) return null;
                                return (
                                  <AcoesPopupMapa
                                    row={row}
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
                                  />
                                );
                              }
                        }
                      />
                    )}
                  </CardBody>
                </Card>
              </div>
            )}

            {aba === "status_dia" && (
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
                          motivoOutrosAtual={row.motivo_outros}
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
                          onAplicarFerias={async (dataInicio, dataFim, observacao, sobrescrever) => {
                            const preview = await statusDiaService.aplicarFerias(
                              row.colaborador_id,
                              dataInicio,
                              dataFim,
                              observacao,
                              sobrescrever
                            );
                            if (preview.some((p) => p.aplicado)) await carregar();
                            return preview;
                          }}
                          onCancelarFerias={async () => {
                            const { inicio, fim } = statusDiaService.janelaCancelamentoFerias(row.data_referencia);
                            await statusDiaService.cancelarFerias(row.colaborador_id, inicio, fim);
                            await carregar();
                          }}
                        />
                      )
                }
              />
            )}

            {aba === "status_dia" && (
              <div className="mt-4">
                <TabelaCheckinsPertoCasa onSelecionar={setPontoFoco} />
              </div>
            )}

            {aba === "geral" && (
              <>
                <Card className="mb-4">
                  <CardHeader>
                    <h2 className="text-sm font-semibold text-ink dark:text-white">Mapa da equipe</h2>
                  </CardHeader>
                  <CardBody>
                    {carregandoMapaGeral ? (
                      <div className="flex h-[320px] items-center justify-center rounded-lg border border-ink/10 bg-surface">
                        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    ) : (
                      <PresenceMap pontos={pontosMapaGeral} altura={320} />
                    )}
                  </CardBody>
                </Card>
                <TabelaGeralStatus data={dataGeral} onDataChange={setDataGeral} />
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
