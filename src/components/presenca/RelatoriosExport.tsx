import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { hojeISO } from "@/lib/calendario";
import { exportarCSV, exportarExcel } from "@/services/exportService";
import { listarAuditoria } from "@/services/coordenacaoService";
import {
  listarRejeicoes,
  listarRelatorioPorCoordenador,
  listarRelatorioPresenca,
} from "@/services/relatoriosService";
import { TIPOS_RELATORIO, type TipoRelatorio } from "@/types/relatorios";
import type { LinhaRelatorioPresenca } from "@/types/relatorios";

const COLUNAS_PRESENCA: { chave: keyof LinhaRelatorioPresenca; titulo: string }[] = [
  { chave: "colaborador_matricula", titulo: "Matrícula" },
  { chave: "colaborador_nome", titulo: "Nome" },
  { chave: "lider_nome", titulo: "Líder" },
  { chave: "filial_nome", titulo: "Filial" },
  { chave: "status_final", titulo: "Status final" },
  { chave: "hora_envio", titulo: "Hora envio" },
  { chave: "hora_aprovacao", titulo: "Hora aprovação" },
  { chave: "aprovado_por", titulo: "Aprovado por" },
  { chave: "motivo", titulo: "Motivo" },
  { chave: "observacao", titulo: "Observação" },
  { chave: "latitude", titulo: "Latitude" },
  { chave: "longitude", titulo: "Longitude" },
];

function primeiroDiaDoMes(dataISO: string) {
  return `${dataISO.slice(0, 7)}-01`;
}

/** Painel de exportação (Módulo 12): 8 tipos de relatório, cada um em CSV ou Excel. */
export function RelatoriosExport() {
  const [tipo, setTipo] = useState<TipoRelatorio>("diario");
  const [gerando, setGerando] = useState<"csv" | "xlsx" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar(formato: "csv" | "xlsx") {
    setGerando(formato);
    setErro(null);
    try {
      const hoje = hojeISO();

      if (tipo === "auditoria") {
        const logs = await listarAuditoria({});
        const linhas = logs.map((l) => ({
          data: new Date(l.created_at).toLocaleString("pt-BR"),
          acao: l.acao,
          entidade: l.entidade,
          ator: l.ator_nome ?? "Sistema",
          detalhes: l.detalhes ? JSON.stringify(l.detalhes) : "",
        }));
        const colunas = [
          { chave: "data" as const, titulo: "Data/hora" },
          { chave: "acao" as const, titulo: "Ação" },
          { chave: "entidade" as const, titulo: "Entidade" },
          { chave: "ator" as const, titulo: "Responsável" },
          { chave: "detalhes" as const, titulo: "Detalhes" },
        ];
        formato === "csv"
          ? exportarCSV(linhas, colunas, "auditoria.csv")
          : exportarExcel(linhas, colunas, "auditoria.xlsx");
        return;
      }

      if (tipo === "rejeicoes") {
        const trintaDiasAtras = new Date();
        trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
        const eventos = await listarRejeicoes(trintaDiasAtras.toISOString().slice(0, 10), hoje);
        const linhas = eventos.map((e) => ({
          data: new Date(e.created_at).toLocaleString("pt-BR"),
          responsavel: e.ator_nome ?? "Sistema",
          status_dia_id: e.entidade_id ?? "",
          detalhes: e.detalhes ? JSON.stringify(e.detalhes) : "",
        }));
        const colunas = [
          { chave: "data" as const, titulo: "Data/hora" },
          { chave: "responsavel" as const, titulo: "Responsável" },
          { chave: "status_dia_id" as const, titulo: "ID do status do dia" },
          { chave: "detalhes" as const, titulo: "Detalhes" },
        ];
        formato === "csv"
          ? exportarCSV(linhas, colunas, "rejeicoes.csv")
          : exportarExcel(linhas, colunas, "rejeicoes.xlsx");
        return;
      }

      let linhas: LinhaRelatorioPresenca[];
      switch (tipo) {
        case "diario":
          linhas = await listarRelatorioPresenca({ inicio: hoje, fim: hoje });
          break;
        case "mensal":
          linhas = await listarRelatorioPresenca({ inicio: primeiroDiaDoMes(hoje), fim: hoje });
          break;
        case "por_lider":
          linhas = (await listarRelatorioPresenca({ inicio: primeiroDiaDoMes(hoje), fim: hoje })).sort((a, b) =>
            (a.lider_nome ?? "").localeCompare(b.lider_nome ?? "")
          );
          break;
        case "por_filial":
          linhas = (await listarRelatorioPresenca({ inicio: primeiroDiaDoMes(hoje), fim: hoje })).sort((a, b) =>
            a.filial_nome.localeCompare(b.filial_nome)
          );
          break;
        case "por_coordenador":
          linhas = await listarRelatorioPorCoordenador({ inicio: primeiroDiaDoMes(hoje), fim: hoje });
          break;
        case "pendencias":
          linhas = await listarRelatorioPresenca({ inicio: hoje, fim: hoje, apenasPendencias: true });
          break;
        default:
          linhas = [];
      }

      const nomeBase = TIPOS_RELATORIO.find((t) => t.tipo === tipo)?.label.toLowerCase().replace(/\s+/g, "-") ?? tipo;
      formato === "csv"
        ? exportarCSV(linhas, COLUNAS_PRESENCA, `${nomeBase}.csv`)
        : exportarExcel(linhas, COLUNAS_PRESENCA, `${nomeBase}.xlsx`);
    } catch (err) {
      console.error(err);
      setErro("Não foi possível gerar o relatório.");
    } finally {
      setGerando(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={tipo}
        onChange={(e) => setTipo(e.target.value as TipoRelatorio)}
        className="h-10 rounded-md border border-ink/20 bg-white px-3 text-sm text-ink"
      >
        {TIPOS_RELATORIO.map((t) => (
          <option key={t.tipo} value={t.tipo}>
            {t.label}
          </option>
        ))}
      </select>

      <Button variant="secondary" size="md" onClick={() => gerar("csv")} loading={gerando === "csv"}>
        Exportar CSV
      </Button>
      <Button variant="secondary" size="md" onClick={() => gerar("xlsx")} loading={gerando === "xlsx"}>
        Exportar Excel
      </Button>

      {erro && <span className="text-xs font-medium text-danger">{erro}</span>}
    </div>
  );
}
