import { SlaBadge } from "@/components/presenca/SlaBadge";
import type { RankingSlaLider } from "@/services/slaService";

interface RankingSlaStatusDiaProps {
  ranking: RankingSlaLider[];
  mediaGeralMin: number | null;
  mediaMesAtualMin: number | null;
}

/** Ranking de líderes por tempo médio de aprovação do status_dia (Módulo 10). */
export function RankingSlaStatusDia({ ranking, mediaGeralMin, mediaMesAtualMin }: RankingSlaStatusDiaProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-ink/10 bg-surface p-3">
          <p className="text-xs text-ink/50">Média diária (últimos 30 dias)</p>
          <p className="text-lg font-semibold text-ink">
            {mediaGeralMin != null ? <SlaBadge minutos={mediaGeralMin} /> : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-ink/10 bg-surface p-3">
          <p className="text-xs text-ink/50">Média do mês atual</p>
          <p className="text-lg font-semibold text-ink">
            {mediaMesAtualMin != null ? <SlaBadge minutos={mediaMesAtualMin} /> : "—"}
          </p>
        </div>
      </div>

      {ranking.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink/50">Nenhuma decisão de status do dia registrada ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/50">
                <th className="py-2 pr-4">Líder</th>
                <th className="py-2 pr-4">Decisões</th>
                <th className="py-2 pr-4">Tempo médio</th>
                <th className="py-2 pr-4">Verde / Amarelo / Vermelho</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.lider_id} className="border-b border-ink/5">
                  <td className="py-2.5 pr-4 font-medium text-ink">
                    <span className="mr-2 text-ink/30">#{i + 1}</span>
                    {r.lider_nome}
                  </td>
                  <td className="py-2.5 pr-4 text-ink/60">{r.total_decisoes}</td>
                  <td className="py-2.5 pr-4">
                    <SlaBadge minutos={r.tempo_medio_min} />
                  </td>
                  <td className="py-2.5 pr-4 text-ink/60">
                    <span className="text-[#2E7D32]">{r.verdes}</span> /{" "}
                    <span className="text-[#8A6200]">{r.amarelos}</span> /{" "}
                    <span className="text-danger">{r.vermelhos}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
