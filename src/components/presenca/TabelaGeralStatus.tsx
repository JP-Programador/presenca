import { useEffect, useMemo, useState } from "react";
import { hojeISO } from "@/lib/calendario";
import * as statusDiaService from "@/services/statusDiaService";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { TabelaMensalStatus } from "@/components/presenca/TabelaMensalStatus";
import { STATUS_DIA_LABEL, STATUS_DIA_VALORES, type StatusDia, type StatusDiaRegistro } from "@/types/status";

type Visualizacao = "lista" | "grade";

/** Ícone de lista (visualização padrão, dia único). */
function IconeLista() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M4 5h12M4 10h12M4 15h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Ícone de tabela/grade (resumo mensal). */
function IconeTabela() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="3" y="3.5" width="14" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 8.5h14M8 3.5v13" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

interface TabelaGeralStatusProps {
  /** Controla a data de fora (ex.: sincronizada com o seletor do Mapa operacional). Omitir = data só interna, começando em hoje. */
  data?: string;
  onDataChange?: (data: string) => void;
}

/**
 * Tabela geral (Módulo — pedido de revisão): nome + status, com filtro de
 * dia, status e nome. Complementa o PendenciasPainel (que só olha o dia
 * atual) permitindo consultar qualquer data — útil pra líder/coordenação
 * conferirem um dia específico do histórico.
 *
 * Duas visualizações: "lista" (um dia, uma linha por colaborador — como já
 * era) e "grade" (resumo mensal em cartão-ponto, uma coluna por dia do mês,
 * com sigla do status em cada célula).
 */
export function TabelaGeralStatus({ data: dataControlada, onDataChange }: TabelaGeralStatusProps) {
  const [visualizacao, setVisualizacao] = useState<Visualizacao>("lista");
  const [dataInterna, setDataInterna] = useState(hojeISO());
  const data = dataControlada ?? dataInterna;
  const setData = onDataChange ?? setDataInterna;
  const [status, setStatus] = useState<StatusDia | "">("");
  const [nome, setNome] = useState("");
  const [linhas, setLinhas] = useState<StatusDiaRegistro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (visualizacao !== "lista") return;
    setCarregando(true);
    setErro(null);
    statusDiaService
      .listarStatusDia(data)
      .then(setLinhas)
      .catch(() => setErro("Não foi possível carregar."))
      .finally(() => setCarregando(false));
  }, [data, visualizacao]);

  // Atualiza sozinho a cada 1 min (silencioso, sem reexibir o spinner).
  useEffect(() => {
    if (visualizacao !== "lista") return;
    const intervalo = setInterval(() => {
      statusDiaService.listarStatusDia(data).then(setLinhas).catch(() => {});
    }, 60_000);
    return () => clearInterval(intervalo);
  }, [data, visualizacao]);

  const filtradas = useMemo(() => {
    const termo = nome.trim().toLowerCase();
    return linhas.filter((l) => {
      if (status && l.status !== status) return false;
      if (termo && !l.colaborador_nome?.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [linhas, status, nome]);

  const dadosExportacao = useMemo(
    () =>
      filtradas.map((l) => ({
        nome: l.colaborador_nome ?? "",
        filial: l.filial_nome ?? "",
        status: STATUS_DIA_LABEL[l.status],
        data: l.data_referencia,
      })),
    [filtradas]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex gap-1 rounded-md border border-ink/15 bg-white p-1 dark:border-white/15 dark:bg-[#242424]">
          <button
            type="button"
            title="Lista (um dia)"
            onClick={() => setVisualizacao("lista")}
            className={[
              "flex h-8 w-8 items-center justify-center rounded",
              visualizacao === "lista" ? "bg-primary text-white" : "text-ink/50 hover:bg-surface dark:text-white/50 dark:hover:bg-white/5",
            ].join(" ")}
          >
            <IconeLista />
          </button>
          <button
            type="button"
            title="Resumo mensal (grade)"
            onClick={() => setVisualizacao("grade")}
            className={[
              "flex h-8 w-8 items-center justify-center rounded",
              visualizacao === "grade" ? "bg-primary text-white" : "text-ink/50 hover:bg-surface dark:text-white/50 dark:hover:bg-white/5",
            ].join(" ")}
          >
            <IconeTabela />
          </button>
        </div>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Buscar por nome..."
          className="h-10 flex-1 min-w-[160px] rounded-md border border-ink/15 bg-white px-3 text-sm text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
        />
      </div>

      {visualizacao === "grade" ? (
        <TabelaMensalStatus nomeFiltro={nome} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="h-10 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusDia | "")}
                className="h-10 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
              >
                <option value="">Todos os status</option>
                {STATUS_DIA_VALORES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_DIA_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>

            <ExportButtons
              dados={dadosExportacao}
              nomeBase={`geral-${data}`}
              colunas={[
                { chave: "nome", titulo: "Nome" },
                { chave: "filial", titulo: "Filial" },
                { chave: "status", titulo: "Status" },
                { chave: "data", titulo: "Data" },
              ]}
            />
          </div>

          {erro && <p className="text-sm text-danger">{erro}</p>}

          {carregando ? (
            <div className="flex justify-center py-8">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-ink/10 dark:border-white/10">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/10 bg-surface text-xs uppercase tracking-wide text-ink/50 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                    <th className="px-4 py-2">Nome</th>
                    <th className="px-4 py-2">Filial</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-ink/50 dark:text-white/50">
                        Nenhum resultado para esse filtro.
                      </td>
                    </tr>
                  ) : (
                    filtradas.map((l) => (
                      <tr key={l.id} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                        <td className="px-4 py-2.5 font-medium text-ink dark:text-white">
                          {l.colaborador_nome ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">{l.filial_nome ?? "—"}</td>
                        <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">{STATUS_DIA_LABEL[l.status]}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
