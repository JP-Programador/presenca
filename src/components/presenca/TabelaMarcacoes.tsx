import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { COLUNAS_ATENDIMENTO } from "@/components/presenca/RelatoriosExport";
import { ALTURA_TABELA_COMPACTA } from "@/lib/uiConstantes";
import { formatarDataBR, formatarHoraBR } from "@/lib/formato";
import { listarRelatorioAtendimentos } from "@/services/relatoriosService";
import type { LinhaRelatorioAtendimento } from "@/types/relatorios";

const STATUS_LABEL: Record<LinhaRelatorioAtendimento["status"], string> = {
  aberto: "Aberto",
  pendente_aprovacao_saida: "Aguardando aprovação da saída",
  fechado: "Fechado",
  saida_rejeitada: "Saída rejeitada",
};

const STATUS_COR: Record<LinhaRelatorioAtendimento["status"], string> = {
  aberto: "bg-[#FFF3DB] text-[#8A6200]",
  pendente_aprovacao_saida: "bg-[#E3EEFA] text-[#1E6FA8]",
  fechado: "bg-[#E7F3E8] text-[#2E7D32]",
  saida_rejeitada: "bg-[#FBE7E7] text-danger",
};

/**
 * Relatório de marcações (entrada + saída de atendimento, já emparelhadas) —
 * visualização em tabela na própria tela, além da exportação. Usado tanto no
 * painel do líder (só o próprio time, via RLS) quanto do coordenador.
 */
export function TabelaMarcacoes() {
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
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink dark:text-white">Relatório de marcações</h2>
          <p className="text-xs text-ink/50 dark:text-white/50">
            Últimos 30 dias — entrada, saída, endereços e tempo total.
          </p>
        </div>
        <ExportButtons dados={linhas} colunas={COLUNAS_ATENDIMENTO} nomeBase="relatorio-marcacoes" />
      </CardHeader>
      <CardBody>
        <div className={`overflow-x-auto rounded-lg border border-ink/10 dark:border-white/10 ${ALTURA_TABELA_COMPACTA}`}>
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="sticky top-0 bg-white dark:bg-[#242424]">
              <tr className="border-b border-ink/10 bg-surface text-xs uppercase tracking-wide text-ink/50 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                <th className="px-4 py-2">Colaborador</th>
                <th className="px-4 py-2">Matrícula</th>
                <th className="px-4 py-2">Líder</th>
                <th className="px-4 py-2">Entrada</th>
                <th className="px-4 py-2">Endereço entrada</th>
                <th className="px-4 py-2">Saída</th>
                <th className="px-4 py-2">Endereço saída</th>
                <th className="px-4 py-2">Tempo total</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Alertas</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.registro_presenca_id} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                  <td className="px-4 py-2.5 font-medium text-ink dark:text-white">{l.colaborador_nome}</td>
                  <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">{l.colaborador_matricula}</td>
                  <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">{l.lider_nome ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">
                    {formatarDataBR(l.data_entrada)} {formatarHoraBR(l.hora_entrada)}
                  </td>
                  <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">{l.endereco_entrada ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">
                    {l.hora_saida ? `${formatarDataBR(l.data_saida)} ${formatarHoraBR(l.hora_saida)}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">{l.endereco_saida ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">
                    {l.tempo_total_min != null ? `${Math.floor(l.tempo_total_min / 60)}h${String(l.tempo_total_min % 60).padStart(2, "0")}` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COR[l.status]}`}>
                      {STATUS_LABEL[l.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">{l.alertas_gerados}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
