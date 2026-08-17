import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { PessoaSimples } from "@/services/coordenacaoService";
import { criarColaborador } from "@/services/colaboradoresService";
import type { Filial } from "@/types/domain";

interface ImportarColaboradoresFormProps {
  liderFixo?: PessoaSimples;
  lideres: PessoaSimples[];
  filiais: Filial[];
  onImportado: () => void;
}

interface LinhaPlanilha {
  nome?: string;
  matricula?: string;
  cargo?: string;
  filial?: string;
  lider?: string;
  cep?: string;
}

interface ResultadoLinha {
  linha: number;
  nome: string;
  ok: boolean;
  mensagem?: string;
}

const COLUNAS_MODELO = ["nome", "matricula", "cargo", "filial", "lider", "cep"];
// Nominatim (usado pra geocodificar CEP -> lat/long) pede no máx. 1 req/s —
// folga generosa aqui, já que o volume real de uma importação é pequeno.
const PAUSA_ENTRE_GEOCODIFICACOES_MS = 1100;

function normalizar(texto: string | undefined): string {
  return (texto ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function ImportarColaboradoresForm({ liderFixo, lideres, filiais, onImportado }: ImportarColaboradoresFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processando, setProcessando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoLinha[] | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  function baixarModelo() {
    const linhas = [
      COLUNAS_MODELO,
      [
        "Ana Souza",
        "12345",
        "Técnica de campo",
        filiais[0]?.codigo ?? "24",
        liderFixo ? liderFixo.nome : lideres[0]?.nome ?? "",
        "01310-100",
      ],
    ];
    const planilha = XLSX.utils.aoa_to_sheet(linhas);
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, "Colaboradores");
    XLSX.writeFile(livro, "modelo-colaboradores.xlsx");
  }

  async function processarArquivo(arquivo: File) {
    setProcessando(true);
    setErroGeral(null);
    setResultados(null);
    try {
      const buffer = await arquivo.arrayBuffer();
      const livro = XLSX.read(buffer, { type: "array" });
      const primeiraAba = livro.Sheets[livro.SheetNames[0]];
      const linhas = XLSX.utils.sheet_to_json<LinhaPlanilha>(primeiraAba, { defval: "" });

      if (linhas.length === 0) {
        setErroGeral("A planilha está vazia.");
        return;
      }

      const resultado: ResultadoLinha[] = [];

      for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i];
        const numeroLinha = i + 2; // +1 cabeçalho, +1 índice base 1
        const nome = String(linha.nome ?? "").trim();
        const matricula = String(linha.matricula ?? "").trim();
        const cargo = String(linha.cargo ?? "").trim();
        const filialTexto = normalizar(linha.filial);
        const liderTexto = normalizar(linha.lider);
        const cep = String(linha.cep ?? "").trim();

        if (!nome || !matricula || !cargo) {
          resultado.push({ linha: numeroLinha, nome: nome || "(sem nome)", ok: false, mensagem: "Nome, matrícula e cargo são obrigatórios." });
          continue;
        }

        const filial = filiais.find(
          (f) => normalizar(f.codigo) === filialTexto || normalizar(f.nome) === filialTexto
        );
        if (!filial) {
          resultado.push({ linha: numeroLinha, nome, ok: false, mensagem: `Filial "${linha.filial}" não encontrada.` });
          continue;
        }

        let liderId: string | undefined = liderFixo?.id;
        if (!liderFixo) {
          const lider = lideres.find((l) => normalizar(l.nome) === liderTexto);
          if (!lider) {
            resultado.push({ linha: numeroLinha, nome, ok: false, mensagem: `Líder "${linha.lider}" não encontrado.` });
            continue;
          }
          liderId = lider.id;
        }

        try {
          const criado = await criarColaborador({
            nome,
            matricula,
            cargo,
            liderId: liderId!,
            filialId: filial.id,
            cep: cep || undefined,
          });
          resultado.push({
            linha: numeroLinha,
            nome,
            ok: true,
            mensagem:
              cep && criado.latitude == null
                ? "Importado, mas o CEP não foi localizado no mapa — corrija depois em /colaboradores pro alerta de check-in funcionar."
                : undefined,
          });
          // Pausa só quando teve CEP pra geocodificar — pra não segurar a
          // importação à toa nas linhas sem CEP.
          if (cep) await new Promise((r) => setTimeout(r, PAUSA_ENTRE_GEOCODIFICACOES_MS));
        } catch (err) {
          resultado.push({
            linha: numeroLinha,
            nome,
            ok: false,
            mensagem: err instanceof Error ? err.message : "Erro ao criar colaborador.",
          });
        }
      }

      setResultados(resultado);
      if (resultado.some((r) => r.ok)) onImportado();
    } catch {
      setErroGeral("Não foi possível ler a planilha. Verifique se o arquivo é .xlsx ou .csv válido.");
    } finally {
      setProcessando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const sucessos = resultados?.filter((r) => r.ok).length ?? 0;
  const falhas = resultados?.filter((r) => !r.ok) ?? [];
  const avisosCep = resultados?.filter((r) => r.ok && r.mensagem) ?? [];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink/60 dark:text-white/60">
        Colunas esperadas: <strong>nome, matricula, cargo, filial</strong>
        {!liderFixo && (
          <>
            {" "}
            e <strong>lider</strong>
          </>
        )}
        . Filial pode ser o código ou nome; {!liderFixo && "líder deve ser o nome exato de um líder já cadastrado; "}
        <strong>cep</strong> é opcional (base do alerta de check-in perto de casa); a primeira linha deve conter os
        cabeçalhos.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="md" onClick={baixarModelo}>
          Baixar modelo
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          disabled={processando}
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) processarArquivo(arquivo);
          }}
          className="text-sm text-ink dark:text-white"
        />
        {processando && (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        )}
      </div>

      {erroGeral && <Alert variant="danger">{erroGeral}</Alert>}

      {resultados && (
        <div
          className={[
            "rounded-md border px-4 py-3 text-sm",
            falhas.length === 0
              ? "bg-[#E7F3E8] text-[#2E7D32] border-[#2E7D32]/20"
              : "bg-[#FBE7E7] text-danger border-danger/20",
          ].join(" ")}
        >
          <p>
            {sucessos} de {resultados.length} colaborador(es) importado(s) com sucesso.
          </p>
          {falhas.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-xs">
              {falhas.map((f) => (
                <li key={f.linha}>
                  Linha {f.linha} ({f.nome}): {f.mensagem}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {avisosCep.length > 0 && (
        <div className="rounded-md border border-warning/30 bg-[#FFF3DB] px-4 py-3 text-sm text-[#8A6200]">
          <p>CEP não localizado em {avisosCep.length} linha(s) — importado mesmo assim, sem o alerta de proximidade:</p>
          <ul className="mt-2 list-disc pl-4 text-xs">
            {avisosCep.map((a) => (
              <li key={a.linha}>
                Linha {a.linha} ({a.nome})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
