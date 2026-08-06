import { useEffect, useMemo, useState } from "react";
import { intervaloDeDatas } from "@/lib/calendario";
import * as statusDiaService from "@/services/statusDiaService";
import { exportarCSV, exportarExcel } from "@/services/exportService";
import { Button } from "@/components/ui/Button";
import { STATUS_DIA_LABEL, type StatusDia, type StatusDiaRegistro } from "@/types/status";

const SIGLA: Record<StatusDia, string> = {
  PRESENTE: "P",
  FALTA: "F",
  ATESTADO: "A",
  FOLGA: "FO",
  OUTROS: "O",
  PENDENTE: "PE",
};

const CORES: Record<StatusDia, string> = {
  PRESENTE: "bg-[#E7F3E8] text-[#2E7D32]",
  PENDENTE: "bg-[#FFF3DB] text-[#8A6200]",
  FALTA: "bg-[#FBE7E7] text-danger",
  ATESTADO: "bg-[#E3EEFA] text-[#1E6FA8]",
  FOLGA: "bg-surface text-ink/60 dark:bg-white/10 dark:text-white/60",
  OUTROS: "bg-surface text-ink/60 dark:bg-white/10 dark:text-white/60",
};

interface LinhaColaborador {
  colaborador_id: string;
  nome: string;
  filial_nome: string;
  porDia: Map<string, StatusDiaRegistro>;
}

function mesAtualISO(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

/** Primeiro e último dia (YYYY-MM-DD) do mês "YYYY-MM" informado. */
function limitesDoMes(mesISO: string): { inicio: string; fim: string } {
  const [ano, mes] = mesISO.split("-").map(Number);
  const inicio = `${mesISO}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const fim = `${mesISO}-${String(ultimoDia).padStart(2, "0")}`;
  return { inicio, fim };
}

interface TabelaMensalStatusProps {
  nomeFiltro: string;
}

/** Tabela mensal em grade (nome × dia), estilo cartão-ponto — resumo do mês com uma sigla por dia. */
export function TabelaMensalStatus({ nomeFiltro }: TabelaMensalStatusProps) {
  const [mes, setMes] = useState(mesAtualISO());
  const [linhas, setLinhas] = useState<StatusDiaRegistro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const { inicio, fim } = useMemo(() => limitesDoMes(mes), [mes]);
  const dias = useMemo(() => intervaloDeDatas(inicio, fim), [inicio, fim]);

  useEffect(() => {
    setCarregando(true);
    setErro(null);
    statusDiaService
      .listarStatusDiaPeriodo(inicio, fim)
      .then(setLinhas)
      .catch(() => setErro("Não foi possível carregar."))
      .finally(() => setCarregando(false));
  }, [inicio, fim]);

  const colaboradores = useMemo(() => {
    const mapa = new Map<string, LinhaColaborador>();
    for (const l of linhas) {
      if (!mapa.has(l.colaborador_id)) {
        mapa.set(l.colaborador_id, {
          colaborador_id: l.colaborador_id,
          nome: l.colaborador_nome ?? "—",
          filial_nome: l.filial_nome ?? "—",
          porDia: new Map(),
        });
      }
      mapa.get(l.colaborador_id)!.porDia.set(l.data_referencia, l);
    }
    const termo = nomeFiltro.trim().toLowerCase();
    return Array.from(mapa.values())
      .filter((c) => !termo || c.nome.toLowerCase().includes(termo))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [linhas, nomeFiltro]);

  function exportar(tipo: "csv" | "excel") {
    const colunas = [
      { chave: "nome", titulo: "Nome" },
      ...dias.map((d) => ({ chave: d, titulo: d.slice(8, 10) + "/" + d.slice(5, 7) })),
    ];
    const dados = colaboradores.map((c) => {
      const linha: Record<string, string> = { nome: c.nome };
      for (const d of dias) {
        const item = c.porDia.get(d);
        linha[d] = item ? SIGLA[item.status] : "";
      }
      return linha;
    });
    const nomeArquivo = `resumo-mensal-${mes}`;
    if (tipo === "csv") exportarCSV(dados, colunas, `${nomeArquivo}.csv`);
    else exportarExcel(dados, colunas, `${nomeArquivo}.xlsx`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="h-10 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
        />
        <div className="flex gap-2">
          <Button variant="secondary" size="md" onClick={() => exportar("csv")} disabled={colaboradores.length === 0}>
            Exportar CSV
          </Button>
          <Button variant="secondary" size="md" onClick={() => exportar("excel")} disabled={colaboradores.length === 0}>
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-ink/60 dark:text-white/60">
        {(Object.keys(SIGLA) as StatusDia[]).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className={["rounded px-1.5 py-0.5 font-semibold", CORES[s]].join(" ")}>{SIGLA[s]}</span>
            {STATUS_DIA_LABEL[s]}
          </span>
        ))}
      </div>

      {erro && <p className="text-sm text-danger">{erro}</p>}

      {carregando ? (
        <div className="flex justify-center py-8">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : colaboradores.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink/50 dark:text-white/50">Nenhum resultado para esse mês.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ink/10 dark:border-white/10">
          <table className="text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-surface text-xs uppercase tracking-wide text-ink/50 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                <th className="sticky left-0 z-10 min-w-[180px] bg-surface px-4 py-2 dark:bg-[#1e1e1e]">Nome</th>
                {dias.map((d) => {
                  const diaSemana = new Date(`${d}T00:00:00`).getDay();
                  const fimDeSemana = diaSemana === 0 || diaSemana === 6;
                  return (
                    <th
                      key={d}
                      className={[
                        "min-w-[44px] px-2 py-2 text-center",
                        fimDeSemana ? "bg-ink/5 dark:bg-white/10" : "",
                      ].join(" ")}
                    >
                      {d.slice(8, 10)}/{d.slice(5, 7)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {colaboradores.map((c) => (
                <tr key={c.colaborador_id} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2 font-medium text-ink dark:bg-[#242424] dark:text-white">
                    {c.nome}
                  </td>
                  {dias.map((d) => {
                    const item = c.porDia.get(d);
                    return (
                      <td key={d} className="px-2 py-2 text-center">
                        {item ? (
                          <span
                            className={["inline-flex h-6 min-w-[26px] items-center justify-center rounded px-1 text-xs font-bold", CORES[item.status]].join(
                              " "
                            )}
                            title={STATUS_DIA_LABEL[item.status]}
                          >
                            {SIGLA[item.status]}
                          </span>
                        ) : (
                          <span className="text-ink/20 dark:text-white/20">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
