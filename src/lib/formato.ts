// Formatação de data/hora no padrão usado em toda a UI (pt-BR, fuso de São
// Paulo) — usado tanto nas telas quanto nas planilhas exportadas, pra nunca
// mais vazar um timestamp cru (ex.: "2026-08-21T15:32:17.279112+00:00").

const FUSO = "America/Sao_Paulo";

/** "2026-08-21" -> "21/08/2026". Aceita null/undefined. */
export function formatarDataBR(dataISO?: string | null): string {
  if (!dataISO) return "";
  const [ano, mes, dia] = dataISO.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return dataISO;
  return `${dia}/${mes}/${ano}`;
}

/** Timestamp completo (ISO, qualquer precisão/offset) -> "HH:mm". */
export function formatarHoraBR(timestampISO?: string | null): string {
  if (!timestampISO) return "";
  const data = new Date(timestampISO);
  if (Number.isNaN(data.getTime())) return timestampISO;
  return data.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
}

/** Timestamp completo -> "21/08/2026 15:32". */
export function formatarDataHoraBR(timestampISO?: string | null): string {
  if (!timestampISO) return "";
  const data = new Date(timestampISO);
  if (Number.isNaN(data.getTime())) return timestampISO;
  return data.toLocaleString("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
