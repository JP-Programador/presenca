import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { ALTURA_TABELA_COMPACTA } from "@/lib/uiConstantes";
import { formatarDataBR } from "@/lib/formato";
import { listarFaltasRecorrentes } from "@/services/relatoriosService";
import type { FaltaRecorrente } from "@/types/relatorios";

const COLUNAS = [
  { chave: "colaborador_nome" as const, titulo: "Colaborador" },
  { chave: "colaborador_matricula" as const, titulo: "Matrícula" },
  { chave: "filial_nome" as const, titulo: "Filial" },
  { chave: "lider_nome" as const, titulo: "Líder" },
  { chave: "coordenador_nome" as const, titulo: "Coordenador" },
  { chave: "total_faltas" as const, titulo: "Total de faltas" },
  { chave: "primeira_falta" as const, titulo: "Primeira falta", formatar: (v: unknown) => formatarDataBR(v as string) },
  { chave: "ultima_falta" as const, titulo: "Última falta", formatar: (v: unknown) => formatarDataBR(v as string) },
];

/** Só auditoria/admin vê isso — colaboradores com mais de 3 faltas nos últimos 30 dias, com líder e coordenador. */
export function FaltasRecorrentesCard() {
  const [linhas, setLinhas] = useState<FaltaRecorrente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    listarFaltasRecorrentes(30, 3)
      .then(setLinhas)
      .catch(() => setErro(true))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando || erro) return null;

  return (
    <Card className="mb-6 border-danger/30">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink dark:text-white">Faltas recorrentes</h2>
          <p className="text-xs text-ink/50 dark:text-white/50">
            Colaboradores com mais de 3 dias de falta nos últimos 30 dias.
          </p>
        </div>
        {linhas.length > 0 && <ExportButtons dados={linhas} colunas={COLUNAS} nomeBase="faltas-recorrentes" />}
      </CardHeader>
      <CardBody>
        {linhas.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink/50 dark:text-white/50">
            Nenhum colaborador com mais de 3 faltas nos últimos 30 dias.
          </p>
        ) : (
          <div className={`overflow-x-auto rounded-lg border border-ink/10 dark:border-white/10 ${ALTURA_TABELA_COMPACTA}`}>
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="sticky top-0 bg-white dark:bg-[#242424]">
                <tr className="border-b border-ink/10 bg-surface text-xs uppercase tracking-wide text-ink/50 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                  <th className="px-4 py-2">Colaborador</th>
                  <th className="px-4 py-2">Matrícula</th>
                  <th className="px-4 py-2">Filial</th>
                  <th className="px-4 py-2">Líder</th>
                  <th className="px-4 py-2">Coordenador</th>
                  <th className="px-4 py-2">Faltas</th>
                  <th className="px-4 py-2">Primeira</th>
                  <th className="px-4 py-2">Última</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.colaborador_id} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                    <td className="px-4 py-2.5 font-medium text-ink dark:text-white">{l.colaborador_nome}</td>
                    <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">{l.colaborador_matricula}</td>
                    <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">{l.filial_nome}</td>
                    <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">{l.lider_nome ?? "—"}</td>
                    <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">{l.coordenador_nome ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-[#FBE7E7] px-2.5 py-1 text-xs font-semibold text-danger">
                        {l.total_faltas}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">{formatarDataBR(l.primeira_falta)}</td>
                    <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">{formatarDataBR(l.ultima_falta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
