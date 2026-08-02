import type { SlaLider } from "@/types/domain";

function corSla(pct: number | null) {
  if (pct == null) return "text-ink/40";
  if (pct >= 90) return "text-[#2E7D32]";
  if (pct >= 70) return "text-[#8A6200]";
  return "text-danger";
}

export function RankingLideres({ dados }: { dados: SlaLider[] }) {
  if (dados.length === 0) {
    return <p className="py-8 text-center text-sm text-ink/50">Nenhuma decisão registrada ainda.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/50">
            <th className="py-2 pr-4">Líder</th>
            <th className="py-2 pr-4">Filial</th>
            <th className="py-2 pr-4">Decisões</th>
            <th className="py-2 pr-4">Tempo médio</th>
            <th className="py-2 pr-4">% dentro do SLA</th>
            <th className="py-2 pr-4">Pendências agora</th>
          </tr>
        </thead>
        <tbody>
          {dados.map((lider, i) => (
            <tr key={lider.gestor_id} className="border-b border-ink/5">
              <td className="py-2.5 pr-4 font-medium text-ink">
                <span className="mr-2 text-ink/30">#{i + 1}</span>
                {lider.gestor_nome}
              </td>
              <td className="py-2.5 pr-4 text-ink/60">{lider.filial_home_nome ?? "—"}</td>
              <td className="py-2.5 pr-4 text-ink/60">
                {lider.total_decisoes} <span className="text-ink/30">({lider.total_aprovadas} aprov.)</span>
              </td>
              <td className="py-2.5 pr-4 text-ink/60">
                {lider.tempo_medio_min != null ? `${lider.tempo_medio_min} min` : "—"}
              </td>
              <td className={["py-2.5 pr-4 font-semibold", corSla(lider.pct_dentro_sla)].join(" ")}>
                {lider.pct_dentro_sla != null ? `${lider.pct_dentro_sla}%` : "—"}
              </td>
              <td className="py-2.5 pr-4">
                {lider.pendencias_atuais > 0 ? (
                  <span className="rounded-full bg-[#FFF3DB] px-2 py-0.5 text-xs font-semibold text-[#8A6200]">
                    {lider.pendencias_atuais}
                  </span>
                ) : (
                  <span className="text-ink/30">0</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
