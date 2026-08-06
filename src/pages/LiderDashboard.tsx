import { useEffect, useState } from "react";
import { BrandHeader } from "@/components/layout/BrandHeader";
import { NavPaineis } from "@/components/layout/NavPaineis";
import { Alert } from "@/components/ui/Alert";
import { StatusActionMenu } from "@/components/presenca/StatusActionMenu";
import { PendenciasPainel } from "@/components/presenca/PendenciasPainel";
import { MiniMapCard } from "@/components/presenca/MiniMapCard";
import { TabelaGeralStatus } from "@/components/presenca/TabelaGeralStatus";
import { useAuth } from "@/providers/AuthProvider";
import { hojeISO } from "@/lib/calendario";
import * as statusDiaService from "@/services/statusDiaService";
import { listarMapaOperacional } from "@/services/mapaOperacionalService";
import type { MotivoOutros, PontoMapaOperacional, StatusDiaRegistro } from "@/types/status";

type Aba = "status_dia" | "geral";

export function LiderDashboard() {
  // Sessão já validada por <RequireAuth> na definição das rotas.
  const { usuario, sair } = useAuth();
  const [aba, setAba] = useState<Aba>("status_dia");
  const [statusDoDia, setStatusDoDia] = useState<StatusDiaRegistro[]>([]);
  const [pontosMapa, setPontosMapa] = useState<PontoMapaOperacional[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [buscaNome, setBuscaNome] = useState("");

  async function carregar() {
    setCarregandoLista(true);
    setErro(null);
    try {
      const [statusDia, pontos] = await Promise.all([
        statusDiaService.listarStatusDia(hojeISO()),
        listarMapaOperacional(hojeISO()),
      ]);
      setStatusDoDia(statusDia);
      setPontosMapa(pontos);
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

  useEffect(() => {
    if (usuario) carregar();
  }, [usuario]);

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

            {aba === "geral" && <TabelaGeralStatus />}
          </div>
        )}
      </main>
    </div>
  );
}
