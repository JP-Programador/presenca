import { useEffect, useMemo, useState } from "react";
import { BrandHeader } from "@/components/layout/BrandHeader";
import { NavPaineis } from "@/components/layout/NavPaineis";
import { Alert } from "@/components/ui/Alert";
import { MetricCard } from "@/components/ui/MetricCard";
import { PendenteLancarCard } from "@/components/presenca/PendenteLancarCard";
import { StatusActionMenu } from "@/components/presenca/StatusActionMenu";
import { PendenciasPainel } from "@/components/presenca/PendenciasPainel";
import { MiniMapCard } from "@/components/presenca/MiniMapCard";
import { TabelaGeralStatus } from "@/components/presenca/TabelaGeralStatus";
import { useAuth } from "@/providers/AuthProvider";
import { hojeISO } from "@/lib/calendario";
import * as statusDiaService from "@/services/statusDiaService";
import { listarMapaOperacional } from "@/services/mapaOperacionalService";
import { contarColaboradoresAtivos } from "@/services/colaboradoresService";
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

  // Aba "Geral": data selecionável (não fixa em hoje) e o mapa dessa aba
  // segue a mesma data escolhida na tabela.
  const [dataGeral, setDataGeral] = useState(hojeISO());
  const [pontosMapaGeral, setPontosMapaGeral] = useState<PontoMapaOperacional[]>([]);
  const [carregandoMapaGeral, setCarregandoMapaGeral] = useState(true);

  async function carregar() {
    setCarregandoLista(true);
    setErro(null);
    try {
      const [statusDia, pontos, totalEscalados] = await Promise.all([
        statusDiaService.listarStatusDia(hojeISO()),
        listarMapaOperacional(hojeISO()),
        contarColaboradoresAtivos(),
      ]);
      setStatusDoDia(statusDia);
      setPontosMapa(pontos);
      setEscalados(totalEscalados);
    } catch (err) {
      setErro("Não foi possível carregar as pendências. Atualize a página.");
    } finally {
      setCarregandoLista(false);
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
      statusDiaService
        .listarStatusDia(hojeISO())
        .then(setStatusDoDia)
        .catch(() => {});
      listarMapaOperacional(hojeISO())
        .then(setPontosMapa)
        .catch(() => {});
      if (dataGeral === hojeISO()) carregarMapaGeral(true);
    }, 60_000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, dataGeral]);

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

  return (
    <div className="min-h-screen bg-surface dark:bg-[#1A1A1A]">
      <BrandHeader
        title={`Olá, ${usuario?.nome.split(" ")[0]}`}
        subtitle="Aprovações pendentes da sua filial"
        right={<NavPaineis perfil={usuario.perfil} atual="lider" onSair={sair} />}
      />

      <main className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
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

        {carregandoLista ? (
          <div className="flex justify-center py-12">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {aba === "status_dia" && (
              <div className="mb-4">
                <MiniMapCard titulo="Mapa da filial (hoje)" pontos={pontosMapa} filtroNome={buscaNome} />
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

            {aba === "geral" && (
              <>
                <MiniMapCard
                  titulo="Mapa da filial"
                  pontos={pontosMapaGeral}
                  carregando={carregandoMapaGeral}
                />
                <TabelaGeralStatus data={dataGeral} onDataChange={setDataGeral} />
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
