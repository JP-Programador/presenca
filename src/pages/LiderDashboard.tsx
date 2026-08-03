import { useEffect, useState } from "react";
import { BrandHeader } from "@/components/layout/BrandHeader";
import { NavPaineis } from "@/components/layout/NavPaineis";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { PendenteCard } from "@/components/presenca/PendenteCard";
import { StatusActionMenu } from "@/components/presenca/StatusActionMenu";
import { PendenciasPainel } from "@/components/presenca/PendenciasPainel";
import { MiniMapCard } from "@/components/presenca/MiniMapCard";
import { TabelaGeralStatus } from "@/components/presenca/TabelaGeralStatus";
import { useAuth } from "@/providers/AuthProvider";
import { hojeISO } from "@/lib/calendario";
import { aprovarRegistro, listarRegistrosPendentes, rejeitarRegistro } from "@/services/presencaService";
import * as statusDiaService from "@/services/statusDiaService";
import { listarMapaOperacional } from "@/services/mapaOperacionalService";
import type { RegistroPresenca } from "@/types/domain";
import type { MotivoOutros, PontoMapaOperacional, StatusDiaRegistro } from "@/types/status";

const TIPO_LABEL: Record<string, string> = {
  entrada: "Entrada",
  inicio_intervalo: "Início do intervalo",
  fim_intervalo: "Fim do intervalo",
  saida: "Saída",
};

type Aba = "presenca" | "status_dia" | "geral";

export function LiderDashboard() {
  // Sessão já validada por <RequireAuth> na definição das rotas.
  const { usuario, sair } = useAuth();
  const [aba, setAba] = useState<Aba>("presenca");
  const [registros, setRegistros] = useState<RegistroPresenca[]>([]);
  const [statusDoDia, setStatusDoDia] = useState<StatusDiaRegistro[]>([]);
  const [pontosMapa, setPontosMapa] = useState<PontoMapaOperacional[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregandoLista(true);
    setErro(null);
    try {
      const [regs, statusDia, pontos] = await Promise.all([
        listarRegistrosPendentes(),
        statusDiaService.listarStatusDia(hojeISO()),
        listarMapaOperacional(hojeISO()),
      ]);
      setRegistros(regs);
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
    setStatusDoDia((prev) => prev.map((item) => (item.id === row.id ? atualizado : item)));
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
        <div className="mb-5 grid grid-cols-3 gap-2 rounded-md bg-white p-1 shadow-sm dark:bg-[#242424] sm:flex">
          <button
            onClick={() => setAba("presenca")}
            className={[
              "rounded-md px-3 py-2 text-xs font-semibold transition-colors sm:flex-1 sm:text-sm",
              aba === "presenca" ? "bg-primary text-white" : "text-ink/60 hover:bg-surface dark:hover:bg-white/5",
            ].join(" ")}
          >
            Presença ({registros.length})
          </button>
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
            {aba === "presenca" &&
              (registros.length === 0 ? (
                <EmptyState mensagem="Nenhum registro aguardando aprovação." />
              ) : (
                registros.map((r) => (
                  <PendenteCard
                    key={r.id}
                    nome={r.colaborador_nome ?? "Colaborador"}
                    matricula={r.colaborador_matricula}
                    filial={r.filial_nome}
                    dataReferencia={r.data_referencia}
                    descricao={`${TIPO_LABEL[r.tipo] ?? r.tipo} · ${new Date(
                      r.horario_registrado
                    ).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}${
                      r.observacao ? ` · ${r.observacao}` : ""
                    }`}
                    fotoPath={r.foto_path}
                    somenteLeitura={ehAuditor}
                    onAprovar={async () => {
                      await aprovarRegistro(r.id);
                      setRegistros((prev) => prev.filter((item) => item.id !== r.id));
                      const statusDiaVinculado = statusDoDia.find(
                        (s) => s.registro_presenca_id === r.id && s.status === "PENDENTE"
                      );
                      if (statusDiaVinculado) {
                        await aplicarEventoStatusDia(statusDiaVinculado, () =>
                          statusDiaService.aplicarEvento(statusDiaVinculado, { tipo: "APROVAR" })
                        );
                      } else {
                        statusDiaService.listarStatusDia(hojeISO()).then(setStatusDoDia);
                      }
                    }}
                    onRejeitar={async () => {
                      await rejeitarRegistro(r.id);
                      setRegistros((prev) => prev.filter((item) => item.id !== r.id));
                      const statusDiaVinculado = statusDoDia.find(
                        (s) => s.registro_presenca_id === r.id && s.status === "PENDENTE"
                      );
                      if (statusDiaVinculado) {
                        await aplicarEventoStatusDia(statusDiaVinculado, () =>
                          statusDiaService.aplicarEvento(statusDiaVinculado, { tipo: "REJEITAR" })
                        );
                      } else {
                        statusDiaService.listarStatusDia(hojeISO()).then(setStatusDoDia);
                      }
                    }}
                  />
                ))
              ))}

            {aba === "status_dia" && (
              <div className="mb-4">
                <MiniMapCard titulo="Mapa da filial (hoje)" pontos={pontosMapa} />
              </div>
            )}

            {aba === "status_dia" && (
              <PendenciasPainel
                itens={statusDoDia}
                renderAcoes={
                  ehAuditor
                    ? undefined
                    : (row) => (
                        <StatusActionMenu
                          nome={row.colaborador_nome ?? "Colaborador"}
                          statusAtual={row.status}
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
