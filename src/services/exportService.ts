import * as XLSX from "xlsx";

/** Converte um array de objetos "achatados" em linhas de tabela (mesma ordem de colunas). */
function paraLinhas<T extends object>(dados: T[], colunas: { chave: keyof T; titulo: string }[]) {
  const cabecalho = colunas.map((c) => c.titulo);
  const linhas = dados.map((item) => colunas.map((c) => item[c.chave] ?? ""));
  return [cabecalho, ...linhas];
}

function baixarArquivo(conteudo: BlobPart, nomeArquivo: string, mime: string) {
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Exporta como CSV (separador ";", compatível com Excel em pt-BR). */
export function exportarCSV<T extends object>(
  dados: T[],
  colunas: { chave: keyof T; titulo: string }[],
  nomeArquivo: string
) {
  const linhas = paraLinhas(dados, colunas);
  const csv = linhas
    .map((linha) =>
      linha
        .map((valor) => {
          const texto = String(valor).replace(/"/g, '""');
          return /[;"\n]/.test(texto) ? `"${texto}"` : texto;
        })
        .join(";")
    )
    .join("\n");

  // BOM para o Excel reconhecer UTF-8 corretamente
  baixarArquivo("\uFEFF" + csv, nomeArquivo, "text/csv;charset=utf-8;");
}

/** Exporta como planilha .xlsx (SheetJS). */
export function exportarExcel<T extends object>(
  dados: T[],
  colunas: { chave: keyof T; titulo: string }[],
  nomeArquivo: string,
  nomeAba = "Dados"
) {
  const linhas = paraLinhas(dados, colunas);
  const planilha = XLSX.utils.aoa_to_sheet(linhas);
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, nomeAba);
  XLSX.writeFile(livro, nomeArquivo);
}
