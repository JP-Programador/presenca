import { Button } from "@/components/ui/Button";
import { exportarCSV, exportarExcel, type ColunaExportacao } from "@/services/exportService";

interface ExportButtonsProps<T extends object> {
  dados: T[];
  colunas: ColunaExportacao<T>[];
  nomeBase: string; // sem extensão, ex.: "auditoria-2026-07"
}

/** Par de botões "Exportar CSV" / "Exportar Excel" reutilizado nos dashboards. */
export function ExportButtons<T extends object>({
  dados,
  colunas,
  nomeBase,
}: ExportButtonsProps<T>) {
  return (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        size="md"
        onClick={() => exportarCSV(dados, colunas, `${nomeBase}.csv`)}
        disabled={dados.length === 0}
      >
        Exportar CSV
      </Button>
      <Button
        variant="secondary"
        size="md"
        onClick={() => exportarExcel(dados, colunas, `${nomeBase}.xlsx`)}
        disabled={dados.length === 0}
      >
        Exportar Excel
      </Button>
    </div>
  );
}
