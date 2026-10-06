import { supabase } from "@/services/supabaseClient";
import type { Colaborador } from "@/types/domain";

export interface DemissaoRh {
  matricula_norm: string;
  nome: string;
  data_demissao: string;
}

function normalizarMatricula(m: string): string {
  return m.trim().replace(/^0+/, "");
}

function primeiroNome(nome: string): string {
  return nome.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/)[0] ?? "";
}

/** Demitidos do RH (TLP.xlsx) com data de demissão no ano corrente — nunca de anos anteriores. */
export async function listarDemitidosDoAno(): Promise<DemissaoRh[]> {
  const ano = new Date().getFullYear();
  const { data, error } = await supabase
    .from("rh_demitidos")
    .select("matricula_norm, nome, data_demissao")
    .gte("data_demissao", `${ano}-01-01`)
    .lte("data_demissao", `${ano}-12-31`);
  if (error) throw error;
  return (data ?? []) as unknown as DemissaoRh[];
}

/**
 * Cruza colaboradores ativos com a base de RH: mesma matrícula (sem zeros à
 * esquerda) E mesmo primeiro nome — a matrícula sozinha repete entre filiais
 * do RH. Retorna colaboradorId → data da demissão (YYYY-MM-DD).
 */
export function cruzarComDemitidos(colaboradores: Colaborador[], demitidos: DemissaoRh[]): Map<string, string> {
  const porMatricula = new Map<string, DemissaoRh[]>();
  for (const d of demitidos) {
    porMatricula.set(d.matricula_norm, [...(porMatricula.get(d.matricula_norm) ?? []), d]);
  }
  const resultado = new Map<string, string>();
  for (const c of colaboradores) {
    if (!c.ativo) continue;
    const achado = porMatricula
      .get(normalizarMatricula(c.matricula))
      ?.find((d) => primeiroNome(d.nome) === primeiroNome(c.nome));
    if (achado) resultado.set(c.id, achado.data_demissao);
  }
  return resultado;
}
