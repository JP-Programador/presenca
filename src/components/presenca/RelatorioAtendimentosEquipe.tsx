import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { COLUNAS_ATENDIMENTO } from "@/components/presenca/RelatoriosExport";
import { listarRelatorioAtendimentos } from "@/services/relatoriosService";
import type { LinhaRelatorioAtendimento } from "@/types/relatorios";

/**
 * Exportação de atendimentos (entrada+saída) só da própria equipe do líder —
 * a RLS já restringe os dados; aqui só monta o botão de exportar, sem o
 * seletor de outros tipos de relatório (esses ficam só no coordenador).
 */
export function RelatorioAtendimentosEquipe() {
  const [linhas, setLinhas] = useState<LinhaRelatorioAtendimento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    const hoje = new Date().toISOString().slice(0, 10);
    listarRelatorioAtendimentos(trintaDiasAtras.toISOString().slice(0, 10), hoje)
      .then(setLinhas)
      .catch(() => setLinhas([]))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando || linhas.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <h2 className="text-sm font-semibold text-ink dark:text-white">Relatório de atendimentos</h2>
        <p className="text-xs text-ink/50 dark:text-white/50">
          Últimos 30 dias — entrada, saída, endereços e tempo total da sua equipe.
        </p>
      </CardHeader>
      <CardBody>
        <ExportButtons dados={linhas} colunas={COLUNAS_ATENDIMENTO} nomeBase="atendimentos-equipe" />
      </CardBody>
    </Card>
  );
}
