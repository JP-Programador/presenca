import { useEffect, useMemo, useState } from "react";
import { BrandHeader } from "@/components/layout/BrandHeader";
import { NavPaineis } from "@/components/layout/NavPaineis";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { useAuth } from "@/providers/AuthProvider";
import { hojeISO, intervaloDeDatas } from "@/lib/calendario";
import * as statusDiaService from "@/services/statusDiaService";
import { listarColaboradores } from "@/services/colaboradoresService";
import { listarHorariosEntrada } from "@/services/dashboardPresencaService";
import { listarSlaStatusDia, ranquearPorFilial } from "@/services/slaService";
import { AnalyticsMensal } from "@/components/presenca/AnalyticsMensal";
import type { StatusDiaRegistro } from "@/types/status";
import type { Colaborador } from "@/types/domain";

const INTERVALO_MS = 30_000;

/** 5h às 23h — faixa de horário que cobre praticamente todos os turnos. */
const HORAS_GRAFICO = Array.from({ length: 19 }, (_, i) => i + 5);

type Periodo = "hoje" | "7dias" | "mes";

const PERIODOS: { chave: Periodo; label: string }[] = [
  { chave: "hoje", label: "Hoje" },
  { chave: "7dias", label: "Últimos 7 dias" },
  { chave: "mes", label: "Mês atual" },
];

/** Data de início (YYYY-MM-DD) de um período, terminando sempre em hoje. */
function inicioDoPeriodo(periodo: Periodo): string {
  const hoje = new Date();
  if (periodo === "hoje") return hojeISO();
  if (periodo === "7dias") {
    const d = new Date(hoje);
    d.setDate(d.getDate() - 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
}

interface LinhaFilial {
  filial_id: string;
  filial_nome: string;
  escalados: number;
  presentesTotal: number;
  faltasTotal: number;
  slaMedioMin: number | null;
}

export function DashboardPresenca() {
  // Papel (admin/auditor/coordenador/gestor) já validado por <RequireRole> na definição das rotas.
  const { usuario, sair } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [statusComparativo, setStatusComparativo] = useState<StatusDiaRegistro[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [horariosEntrada, setHorariosEntrada] = useState<string[]>([]);
  const [slaMedioPorFilial, setSlaMedioPorFilial] = useState<Map<string, number>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

  const diasConsiderados = useMemo(
    () => intervaloDeDatas(inicioDoPeriodo(periodo), hojeISO()).length,
    [periodo]
  );

  async function carregar(silencioso = false) {
    if (!silencioso) setCarregando(true);
    setErro(null);
    try {
      const trintaDiasAtras = new Date();
      trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
      const [statusPeriodo, colabs, horarios, decisoesSla] = await Promise.all([
        periodo === "hoje"
          ? statusDiaService.listarStatusDia(hojeISO())
          : statusDiaService.listarStatusDiaPeriodo(inicioDoPeriodo(periodo), hojeISO()),
        listarColaboradores(),
        listarHorariosEntrada(hojeISO()),
        listarSlaStatusDia(trintaDiasAtras.toISOString().slice(0, 10)),
      ]);
      setStatusComparativo(statusPeriodo);
      setColaboradores(colabs);
      setHorariosEntrada(horarios);
      setSlaMedioPorFilial(new Map(ranquearPorFilial(decisoesSla).map((f) => [f.filial_id, f.tempo_medio_min])));
      setUltimaAtualizacao(new Date());
    } catch {
      setErro("Não foi possível carregar o painel.");
    } finally {
      if (!silencioso) setCarregando(false);
    }
  }

  useEffect(() => {
    if (usuario) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, periodo]);

  useEffect(() => {
    if (!usuario) return;
    const intervalo = setInterval(() => carregar(true), INTERVALO_MS);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, periodo]);

  const contagemPorHora = useMemo(() => {
    const mapa = new Map<number, number>();
    for (const h of HORAS_GRAFICO) mapa.set(h, 0);
    for (const iso of horariosEntrada) {
      const hora = new Date(iso).getHours();
      if (mapa.has(hora)) mapa.set(hora, (mapa.get(hora) ?? 0) + 1);
    }
    return mapa;
  }, [horariosEntrada]);

  const maxPorHora = useMemo(() => Math.max(1, ...Array.from(contagemPorHora.values())), [contagemPorHora]);

  const linhasPorFilial = useMemo<LinhaFilial[]>(() => {
    const mapa = new Map<string, LinhaFilial>();

    for (const c of colaboradores) {
      if (!c.ativo) continue;
      const linha = mapa.get(c.filial_id) ?? {
        filial_id: c.filial_id,
        filial_nome: c.filial_nome ?? "—",
        escalados: 0,
        presentesTotal: 0,
        faltasTotal: 0,
        slaMedioMin: null,
      };
      linha.escalados += 1;
      mapa.set(c.filial_id, linha);
    }

    for (const s of statusComparativo) {
      const linha = mapa.get(s.filial_id) ?? {
        filial_id: s.filial_id,
        filial_nome: s.filial_nome ?? "—",
        escalados: 0,
        presentesTotal: 0,
        faltasTotal: 0,
        slaMedioMin: null,
      };
      if (s.status === "PRESENTE") linha.presentesTotal += 1;
      if (s.status === "FALTA") linha.faltasTotal += 1;
      mapa.set(s.filial_id, linha);
    }

    for (const linha of mapa.values()) {
      linha.slaMedioMin = slaMedioPorFilial.get(linha.filial_id) ?? null;
    }

    return Array.from(mapa.values()).sort((a, b) => a.filial_nome.localeCompare(b.filial_nome));
  }, [colaboradores, statusComparativo, slaMedioPorFilial]);

  if (!usuario) return null; // narrowing de tipo; na prática nunca alcançado (ver RequireRole)

  const ehLider = usuario.perfil === "gestor";

  return (
    <div className="min-h-screen bg-surface dark:bg-[#1A1A1A]">
      <BrandHeader
        title="Dashboard de presença"
        subtitle={ehLider ? "Gráficos e comparativo da sua equipe" : "Gráficos e comparativo de todas as filiais"}
        right={<NavPaineis perfil={usuario.perfil} atual="dashboard-presenca" onSair={sair} />}
      />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <div className="mb-4 flex items-center justify-end">
          <span className="text-xs text-ink/40 dark:text-white/40">
            {ultimaAtualizacao
              ? `Última atualização: ${ultimaAtualizacao.toLocaleTimeString("pt-BR")}`
              : "Carregando..."}{" "}
            · atualiza sozinho a cada 30s
          </span>
        </div>

        {erro && (
          <div className="mb-4">
            <Alert variant="danger">{erro}</Alert>
          </div>
        )}

        {carregando ? (
          <div className="flex justify-center py-16">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-ink dark:text-white">Presença por horário de entrada</h2>
                <p className="text-xs text-ink/50 dark:text-white/50">
                  Quantidade de check-ins de entrada hoje, por hora do dia.
                </p>
              </CardHeader>
              <CardBody>
                {horariosEntrada.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink/50 dark:text-white/50">
                    Nenhum check-in de entrada hoje ainda.
                  </p>
                ) : (
                  <div className="flex h-40 items-end gap-1 overflow-x-auto">
                    {HORAS_GRAFICO.map((h) => {
                      const total = contagemPorHora.get(h) ?? 0;
                      const alturaPct = (total / maxPorHora) * 100;
                      return (
                        <div key={h} className="flex min-w-[24px] flex-1 flex-col items-center gap-1">
                          <div className="flex h-32 w-full items-end">
                            <div
                              className={[
                                "w-full rounded-t transition-all",
                                total > 0 ? "bg-primary" : "bg-ink/5 dark:bg-white/5",
                              ].join(" ")}
                              style={{ height: `${total > 0 ? Math.max(alturaPct, 4) : 2}%` }}
                              title={`${total} entrada${total === 1 ? "" : "s"} às ${h}h`}
                            />
                          </div>
                          <span className="text-[10px] text-ink/40 dark:text-white/40">{h}h</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-ink dark:text-white">
                    {ehLider ? "Sua filial" : "Comparativo por filial"}
                  </h2>
                  <p className="text-xs text-ink/50 dark:text-white/50">
                    Escalados, presença, faltas e SLA médio de aprovação (SLA sempre últimos 30 dias).
                  </p>
                </div>
                <div className="flex gap-1 rounded-md border border-ink/15 bg-white p-1 dark:border-white/15 dark:bg-[#242424]">
                  {PERIODOS.map((p) => (
                    <button
                      key={p.chave}
                      type="button"
                      onClick={() => setPeriodo(p.chave)}
                      className={[
                        "rounded px-2.5 py-1.5 text-xs font-semibold transition-colors",
                        periodo === p.chave
                          ? "bg-primary text-white"
                          : "text-ink/50 hover:bg-surface dark:text-white/50 dark:hover:bg-white/5",
                      ].join(" ")}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardBody>
                {linhasPorFilial.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink/50 dark:text-white/50">Nenhum dado disponível.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-ink/10 dark:border-white/10">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-ink/10 bg-surface text-xs uppercase tracking-wide text-ink/50 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                          <th className="px-4 py-2">Filial</th>
                          <th className="px-4 py-2 text-right">Escalados</th>
                          <th className="px-4 py-2 text-right" title="Soma de presenças no período">
                            {periodo === "hoje" ? "Presentes" : "Presenças (soma)"}
                          </th>
                          <th className="px-4 py-2 text-right">% disponível{periodo !== "hoje" ? " (médio)" : ""}</th>
                          <th className="px-4 py-2 text-right">Faltas</th>
                          <th className="px-4 py-2 text-right">SLA médio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhasPorFilial.map((l) => {
                          const pct =
                            l.escalados > 0 && diasConsiderados > 0
                              ? Math.round((l.presentesTotal / (l.escalados * diasConsiderados)) * 100)
                              : 0;
                          return (
                            <tr key={l.filial_id} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                              <td className="px-4 py-2.5 font-medium text-ink dark:text-white">{l.filial_nome}</td>
                              <td className="px-4 py-2.5 text-right text-ink/70 dark:text-white/70">{l.escalados}</td>
                              <td className="px-4 py-2.5 text-right text-[#2E7D32]">{l.presentesTotal}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-ink dark:text-white">{pct}%</td>
                              <td className="px-4 py-2.5 text-right text-danger">{l.faltasTotal}</td>
                              <td className="px-4 py-2.5 text-right text-ink/70 dark:text-white/70">
                                {l.slaMedioMin != null ? `${l.slaMedioMin} min` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>

            {!ehLider && <AnalyticsMensal />}
          </div>
        )}
      </main>
    </div>
  );
}
