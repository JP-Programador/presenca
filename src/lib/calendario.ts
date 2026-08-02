// Utilitários de data puros (sem I/O) para classificação de dias.
// A fonte de verdade sobre feriados vem do banco (tabela tlp_presenca.calendario,
// consultada via src/services/calendarioService.ts) — este módulo só sabe
// classificar a partir de um Set de feriados já carregado.

export type TipoDia = "UTIL" | "SABADO" | "DOMINGO" | "FERIADO";

/** Formata uma Date para "YYYY-MM-DD" no fuso local (evita bug de UTC do toISOString). */
export function formatarDataISO(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function hojeISO(): string {
  return formatarDataISO(new Date());
}

/** 0 = domingo ... 6 = sábado, a partir de uma data "YYYY-MM-DD". */
function diaDaSemana(dataISO: string): number {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  return new Date(ano, mes - 1, dia).getDay();
}

/**
 * Classifica uma data em UTIL/SABADO/DOMINGO/FERIADO.
 * `feriados` é o conjunto de datas ("YYYY-MM-DD") marcadas como feriado
 * (ou outra exceção) — normalmente obtido de `calendarioService.carregarExcecoes`.
 */
export function classificarDia(
  dataISO: string,
  excecoes: Map<string, TipoDia>
): TipoDia {
  const excecao = excecoes.get(dataISO);
  if (excecao) return excecao;

  const dow = diaDaSemana(dataISO);
  if (dow === 0) return "DOMINGO";
  if (dow === 6) return "SABADO";
  return "UTIL";
}

/** Dias úteis/sábado/domingo/feriado costumam ditar o status inicial do dia (ver Módulo 6). */
export function ehFimDeSemanaOuFeriado(tipo: TipoDia): boolean {
  return tipo !== "UTIL";
}

export function rotuloTipoDia(tipo: TipoDia): string {
  switch (tipo) {
    case "UTIL":
      return "Dia útil";
    case "SABADO":
      return "Sábado";
    case "DOMINGO":
      return "Domingo";
    case "FERIADO":
      return "Feriado";
  }
}

/** Gera a lista de datas ISO (inclusive) entre duas datas, para telas de relatório/calendário. */
export function intervaloDeDatas(inicioISO: string, fimISO: string): string[] {
  const [anoI, mesI, diaI] = inicioISO.split("-").map(Number);
  const [anoF, mesF, diaF] = fimISO.split("-").map(Number);
  const cursor = new Date(anoI, mesI - 1, diaI);
  const fim = new Date(anoF, mesF - 1, diaF);
  const datas: string[] = [];
  while (cursor <= fim) {
    datas.push(formatarDataISO(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return datas;
}
