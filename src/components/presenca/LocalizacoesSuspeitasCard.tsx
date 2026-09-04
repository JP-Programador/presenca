import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { ALTURA_TABELA_COMPACTA } from "@/lib/uiConstantes";
import { listarLocalizacoesSuspeitas } from "@/services/relatoriosService";
import type { LocalizacaoSuspeita } from "@/types/relatorios";

const TIPO_LABEL: Record<LocalizacaoSuspeita["tipo_suspeita"], string> = {
  teleporte: "Teleporte",
  precisao_suspeita: "Precisão suspeita",
};

function formatarDataHora(v: string | null): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const COLUNAS = [
  { chave: "colaborador_nome" as const, titulo: "Colaborador" },
  { chave: "colaborador_matricula" as const, titulo: "Matrícula" },
  { chave: "lider_nome" as const, titulo: "Líder" },
  { chave: "tipo_suspeita" as const, titulo: "Sinal", formatar: (v: unknown) => TIPO_LABEL[v as LocalizacaoSuspeita["tipo_suspeita"]] },
  { chave: "horario_registrado" as const, titulo: "Quando", formatar: (v: unknown) => formatarDataHora(v as string) },
  { chave: "distancia_km" as const, titulo: "Distância (km)", formatar: (v: unknown) => (v == null ? "—" : (v as number).toFixed(1)) },
  { chave: "velocidade_kmh" as const, titulo: "Velocidade (km/h)", formatar: (v: unknown) => (v == null ? "—" : (v as number).toFixed(0)) },
  { chave: "precisao_metros" as const, titulo: "Precisão GPS (m)", formatar: (v: unknown) => (v == null ? "—" : (v as number).toFixed(1)) },
];

/**
 * Só auditoria/admin vê isso. O navegador não expõe se a localização veio de
 * um app de GPS falso — isso aqui é só um indício indireto (distância entre
 * marcações implicando velocidade impossível, ou precisão de GPS baixa
 * demais pra ser real), não uma prova. Serve pra apontar pra auditoria onde
 * vale a pena olhar caso a caso.
 */
export function LocalizacoesSuspeitasCard() {
  const [linhas, setLinhas] = useState<LocalizacaoSuspeita[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    listarLocalizacoesSuspeitas(30)
      .then(setLinhas)
      .catch(() => setErro(true))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando || erro) return null;

  return (
    <Card className="mb-6 border-warning/30">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink dark:text-white">Localização suspeita (possível GPS fake)</h2>
          <p className="text-xs text-ink/50 dark:text-white/50">
            Indícios indiretos nos últimos 30 dias — não é prova, é sinal pra checar caso a caso.
          </p>
        </div>
        {linhas.length > 0 && <ExportButtons dados={linhas} colunas={COLUNAS} nomeBase="localizacoes-suspeitas" />}
      </CardHeader>
      <CardBody>
        {linhas.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink/50 dark:text-white/50">
            Nenhum sinal de localização suspeita nos últimos 30 dias.
          </p>
        ) : (
          <div className={`overflow-x-auto rounded-lg border border-ink/10 dark:border-white/10 ${ALTURA_TABELA_COMPACTA}`}>
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="sticky top-0 bg-white dark:bg-[#242424]">
                <tr className="border-b border-ink/10 bg-surface text-xs uppercase tracking-wide text-ink/50 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                  <th className="px-4 py-2">Colaborador</th>
                  <th className="px-4 py-2">Matrícula</th>
                  <th className="px-4 py-2">Líder</th>
                  <th className="px-4 py-2">Sinal</th>
                  <th className="px-4 py-2">Quando</th>
                  <th className="px-4 py-2">Distância</th>
                  <th className="px-4 py-2">Velocidade</th>
                  <th className="px-4 py-2">Precisão GPS</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={`${l.colaborador_id}-${l.horario_registrado}-${i}`} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                    <td className="px-4 py-2.5 font-medium text-ink dark:text-white">{l.colaborador_nome}</td>
                    <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">{l.colaborador_matricula}</td>
                    <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">{l.lider_nome ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-[#FFF3D6] px-2.5 py-1 text-xs font-semibold text-warning">
                        {TIPO_LABEL[l.tipo_suspeita]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">{formatarDataHora(l.horario_registrado)}</td>
                    <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">
                      {l.distancia_km == null ? "—" : `${l.distancia_km.toFixed(1)} km`}
                    </td>
                    <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">
                      {l.velocidade_kmh == null ? "—" : `${l.velocidade_kmh.toFixed(0)} km/h`}
                    </td>
                    <td className="px-4 py-2.5 text-ink/60 dark:text-white/60">
                      {l.precisao_metros == null ? "—" : `${l.precisao_metros.toFixed(1)} m`}
                    </td>
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
