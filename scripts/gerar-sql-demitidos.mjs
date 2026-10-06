// Uso: node scripts/gerar-sql-demitidos.mjs "C:\caminho\TLP.xlsx" [ano]
// Gera supabase/seed/demitidos_<ano>.sql (gitignored — dados pessoais) com os
// demitidos do ano. Rode o arquivo gerado no SQL Editor do Supabase.
import XLSX from "xlsx";
import { writeFileSync } from "node:fs";

const [, , arquivo, anoArg] = process.argv;
if (!arquivo) {
  console.error('Uso: node scripts/gerar-sql-demitidos.mjs "<TLP.xlsx>" [ano]');
  process.exit(1);
}
const ano = Number(anoArg ?? new Date().getFullYear());

const wb = XLSX.readFile(arquivo, { cellDates: true });
const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });

const achar = (obj, prefixo) => {
  const chave = Object.keys(obj).find((k) => k.normalize("NFD").replace(/[^\x00-\x7f]/g, "").toUpperCase().includes(prefixo));
  return chave ? obj[chave] : null;
};
const esc = (s) => String(s).replace(/'/g, "''");

const vistos = new Set();
const valores = [];
for (const l of linhas) {
  const dem = achar(l, "DATA DA DEMISS") ?? l[Object.keys(l).find((k) => /DEMISS/i.test(k))];
  if (!(dem instanceof Date) || dem.getFullYear() !== ano) continue;
  const mat = String(Object.entries(l).find(([k]) => /MATR/i.test(k))?.[1] ?? "").trim().replace(/^0+/, "");
  const nome = String(Object.entries(l).find(([k]) => /NOME/i.test(k))?.[1] ?? "").trim();
  if (!mat || !nome) continue;
  const data = dem.toISOString().slice(0, 10);
  const chave = `${mat}|${data}`;
  if (vistos.has(chave)) continue;
  vistos.add(chave);
  const filial = String(l["FILIAL"] ?? "").trim();
  valores.push(`('${esc(mat)}','${esc(nome)}','${data}','${esc(filial)}')`);
}

const sql =
  `-- Demitidos ${ano} (gerado em ${new Date().toISOString().slice(0, 10)}) — ${valores.length} linhas\n` +
  `delete from tlp_presenca.rh_demitidos;\n` +
  `insert into tlp_presenca.rh_demitidos (matricula_norm, nome, data_demissao, filial_rh) values\n` +
  valores.join(",\n") +
  `\non conflict do nothing;\n`;
const saida = `supabase/seed/demitidos_${ano}.sql`;
writeFileSync(saida, sql, "utf8");
console.log(`${valores.length} demitidos de ${ano} → ${saida}`);
