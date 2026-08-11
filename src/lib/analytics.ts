// Cálculos puros (sem I/O) do "Analytics e Histórico Mensal" do dashboard
// de presença — recebem dados já carregados (status_dia do mês + lista de
// colaboradores) e devolvem as séries prontas pra cada gráfico/card.

import { intervaloDeDatas } from "@/lib/calendario";
import type { Colaborador, RegistroPresenca } from "@/types/domain";
import type { StatusDiaRegistro } from "@/types/status";

export const META_PLANTA_DISPONIVEL = 90;

export interface PontoDiario {
  data: string; // YYYY-MM-DD
  presentes: number;
  pct: number;
}

/** % de planta disponível por dia do mês (até hoje, se for o mês corrente). */
export function calcularSerieDiaria(
  statusMes: StatusDiaRegistro[],
  escalados: number,
  inicioMes: string,
  fimMes: string
): PontoDiario[] {
  const dias = intervaloDeDatas(inicioMes, fimMes);
  const porDia = new Map<string, number>();
  for (const s of statusMes) {
    if (s.status !== "PRESENTE") continue;
    porDia.set(s.data_referencia, (porDia.get(s.data_referencia) ?? 0) + 1);
  }
  return dias.map((data) => {
    const presentes = porDia.get(data) ?? 0;
    const pct = escalados > 0 ? Math.round((presentes / escalados) * 100) : 0;
    return { data, presentes, pct };
  });
}

/** QVP — dias em que a meta foi atingida, sobre o total de dias considerados. */
export function calcularQVP(serie: PontoDiario[], meta = META_PLANTA_DISPONIVEL) {
  const diasComDado = serie.filter((p) => p.presentes > 0 || p.pct > 0);
  const diasNaMeta = diasComDado.filter((p) => p.pct >= meta).length;
  return { diasNaMeta, diasTotais: diasComDado.length };
}

interface MapaLider {
  colaboradorParaLider: Map<string, { lider_id: string; lider_nome: string } | null>;
  colaboradoresPorLider: Map<string, number>;
}

/** Monta os mapas colaborador->líder e contagem de time por líder, a partir da lista de colaboradores ativos. */
export function mapearLideres(colaboradores: Colaborador[]): MapaLider {
  const colaboradorParaLider = new Map<string, { lider_id: string; lider_nome: string } | null>();
  const colaboradoresPorLider = new Map<string, number>();
  for (const c of colaboradores) {
    if (!c.ativo) continue;
    if (c.lider_id) {
      colaboradorParaLider.set(c.id, { lider_id: c.lider_id, lider_nome: c.lider_nome ?? "—" });
      colaboradoresPorLider.set(c.lider_id, (colaboradoresPorLider.get(c.lider_id) ?? 0) + 1);
    } else {
      colaboradorParaLider.set(c.id, null);
    }
  }
  return { colaboradorParaLider, colaboradoresPorLider };
}

export interface RankingLiderPlanta {
  lider_id: string;
  lider_nome: string;
  pctMedio: number;
  faltas: number;
  atestados: number;
  /** % de dias-pessoa em falta/atestado sobre o total escalado — quanto maior, pior. */
  taxaAbsenteismo: number;
}

/** Ranking por líder: % médio de planta disponível no período + faltas/atestados acumulados (ofensores). Ordenado do melhor pro pior engajamento. */
export function calcularRankingPorLider(
  statusMes: StatusDiaRegistro[],
  mapaLideres: MapaLider,
  totalDias: number
): RankingLiderPlanta[] {
  interface Acc {
    lider_nome: string;
    presencasDias: number;
    faltas: number;
    atestados: number;
  }
  const acc = new Map<string, Acc>();

  for (const s of statusMes) {
    const lider = mapaLideres.colaboradorParaLider.get(s.colaborador_id);
    if (!lider) continue;
    const atual = acc.get(lider.lider_id) ?? { lider_nome: lider.lider_nome, presencasDias: 0, faltas: 0, atestados: 0 };
    if (s.status === "PRESENTE") atual.presencasDias += 1;
    else if (s.status === "FALTA") atual.faltas += 1;
    else if (s.status === "ATESTADO") atual.atestados += 1;
    acc.set(lider.lider_id, atual);
  }

  return Array.from(acc.entries())
    .map(([lider_id, v]) => {
      const time = mapaLideres.colaboradoresPorLider.get(lider_id) ?? 1;
      const escaladoDias = time * totalDias;
      const pctMedio = escaladoDias > 0 ? Math.round((v.presencasDias / escaladoDias) * 100) : 0;
      const taxaAbsenteismo =
        escaladoDias > 0 ? Math.round(((v.faltas + v.atestados) / escaladoDias) * 1000) / 10 : 0;
      return { lider_id, lider_nome: v.lider_nome, pctMedio, faltas: v.faltas, atestados: v.atestados, taxaAbsenteismo };
    })
    .sort((a, b) => b.pctMedio - a.pctMedio);
}

const NOMES_DIA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export interface CelulaHeatmap {
  semana: number; // 0-indexed, semana do mês
  diaSemana: number; // 1=Seg ... 5=Sex
  data: string;
  faltas: number;
}

/** Heatmap de faltas por dia da semana (Seg-Sex) x semana do mês. */
export function calcularHeatmapFaltas(
  statusMes: StatusDiaRegistro[],
  inicioMes: string,
  fimMes: string
): { celulas: CelulaHeatmap[]; maxFaltas: number; nomesDias: string[] } {
  const faltasPorDia = new Map<string, number>();
  for (const s of statusMes) {
    if (s.status !== "FALTA") continue;
    faltasPorDia.set(s.data_referencia, (faltasPorDia.get(s.data_referencia) ?? 0) + 1);
  }

  const dias = intervaloDeDatas(inicioMes, fimMes);
  const inicioSemana0 = new Date(`${inicioMes}T00:00:00`).getDay(); // dia da semana do dia 1
  const celulas: CelulaHeatmap[] = [];
  let maxFaltas = 0;

  for (const data of dias) {
    const [ano, mes, dia] = data.split("-").map(Number);
    const dt = new Date(ano, mes - 1, dia);
    const dow = dt.getDay();
    if (dow === 0 || dow === 6) continue; // só Seg-Sex
    const diaDoMes = dt.getDate();
    const semana = Math.floor((diaDoMes - 1 + inicioSemana0) / 7);
    const faltas = faltasPorDia.get(data) ?? 0;
    maxFaltas = Math.max(maxFaltas, faltas);
    celulas.push({ semana, diaSemana: dow, data, faltas });
  }

  return { celulas, maxFaltas, nomesDias: NOMES_DIA_SEMANA };
}

// =========================================================
// Visão acumulada de período (semana/mês/30 dias/personalizado) —
// cards consolidados, top ofensores e evolução faltas x atestados.
// =========================================================

export interface AcumuladoPeriodo {
  totalFaltas: number;
  totalAtestados: number;
  totalAtrasos: number;
  pctMedioPlantaDisponivel: number;
}

/** Cards consolidados do período: faltas, atestados, atrasos e % médio de planta disponível. */
export function calcularAcumuladoPeriodo(
  statusPeriodo: StatusDiaRegistro[],
  registrosAtrasados: RegistroPresenca[],
  escalados: number,
  inicioISO: string,
  fimISO: string
): AcumuladoPeriodo {
  const serie = calcularSerieDiaria(statusPeriodo, escalados, inicioISO, fimISO);
  const pctMedio = mediaSimples(serie.map((p) => p.pct));
  return {
    totalFaltas: statusPeriodo.filter((s) => s.status === "FALTA").length,
    totalAtestados: statusPeriodo.filter((s) => s.status === "ATESTADO").length,
    totalAtrasos: registrosAtrasados.length,
    pctMedioPlantaDisponivel: pctMedio,
  };
}

function mediaSimples(valores: number[]): number {
  if (valores.length === 0) return 0;
  return Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10;
}

export interface TopColaboradorFaltas {
  colaborador_id: string;
  nome: string;
  filial_nome: string;
  lider_nome: string;
  faltas: number;
}

/** Top N colaboradores com mais faltas no período. */
export function calcularTopFaltas(
  statusPeriodo: StatusDiaRegistro[],
  mapaLideres: MapaLider,
  limite = 5
): TopColaboradorFaltas[] {
  const acc = new Map<string, TopColaboradorFaltas>();
  for (const s of statusPeriodo) {
    if (s.status !== "FALTA") continue;
    const lider = mapaLideres.colaboradorParaLider.get(s.colaborador_id);
    const atual = acc.get(s.colaborador_id) ?? {
      colaborador_id: s.colaborador_id,
      nome: s.colaborador_nome ?? "—",
      filial_nome: s.filial_nome ?? "—",
      lider_nome: lider?.lider_nome ?? "—",
      faltas: 0,
    };
    atual.faltas += 1;
    acc.set(s.colaborador_id, atual);
  }
  return Array.from(acc.values())
    .sort((a, b) => b.faltas - a.faltas)
    .slice(0, limite);
}

export interface TopColaboradorAtraso {
  colaborador_id: string;
  nome: string;
  filial_nome: string;
  ocorrencias: number;
  mediaMinutos: number | null;
}

/** Top N colaboradores com mais registros de atraso no período (registros_presenca.status='atrasado'). */
export function calcularTopAtrasos(registros: RegistroPresenca[], limite = 5): TopColaboradorAtraso[] {
  interface Acc {
    nome: string;
    filial_nome: string;
    ocorrencias: number;
    somaMinutos: number;
    comHorarioPrevisto: number;
  }
  const acc = new Map<string, Acc>();

  for (const r of registros) {
    const atual = acc.get(r.colaborador_id) ?? {
      nome: r.colaborador_nome ?? "—",
      filial_nome: r.filial_nome ?? "—",
      ocorrencias: 0,
      somaMinutos: 0,
      comHorarioPrevisto: 0,
    };
    atual.ocorrencias += 1;
    if (r.horario_previsto) {
      const [h, m] = r.horario_previsto.split(":").map(Number);
      const previsto = new Date(r.horario_registrado);
      previsto.setHours(h, m, 0, 0);
      const registrado = new Date(r.horario_registrado);
      const diffMin = Math.max(0, Math.round((registrado.getTime() - previsto.getTime()) / 60000));
      atual.somaMinutos += diffMin;
      atual.comHorarioPrevisto += 1;
    }
    acc.set(r.colaborador_id, atual);
  }

  return Array.from(acc.entries())
    .map(([colaborador_id, v]) => ({
      colaborador_id,
      nome: v.nome,
      filial_nome: v.filial_nome,
      ocorrencias: v.ocorrencias,
      mediaMinutos: v.comHorarioPrevisto > 0 ? Math.round(v.somaMinutos / v.comHorarioPrevisto) : null,
    }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias)
    .slice(0, limite);
}

export interface PontoFaltasAtestados {
  data: string;
  faltas: number;
  atestados: number;
}

/** Série diária de Faltas x Atestados no período, para o gráfico de evolução. */
export function calcularSerieFaltasAtestados(
  statusPeriodo: StatusDiaRegistro[],
  inicioISO: string,
  fimISO: string
): PontoFaltasAtestados[] {
  const dias = intervaloDeDatas(inicioISO, fimISO);
  const faltasPorDia = new Map<string, number>();
  const atestadosPorDia = new Map<string, number>();
  for (const s of statusPeriodo) {
    if (s.status === "FALTA") faltasPorDia.set(s.data_referencia, (faltasPorDia.get(s.data_referencia) ?? 0) + 1);
    if (s.status === "ATESTADO")
      atestadosPorDia.set(s.data_referencia, (atestadosPorDia.get(s.data_referencia) ?? 0) + 1);
  }
  return dias.map((data) => ({
    data,
    faltas: faltasPorDia.get(data) ?? 0,
    atestados: atestadosPorDia.get(data) ?? 0,
  }));
}
