import { supabase } from "@/services/supabaseClient";
import type { AuditLogEntry, Filial, RegistroPresenca, SlaLider, UsuarioComHierarquia } from "@/types/domain";

/** Registros com coordenadas nas últimas `horas` horas, para o mapa de presenças. */
export async function listarRegistrosParaMapa(horas = 24): Promise<RegistroPresenca[]> {
  const desde = new Date(Date.now() - horas * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("registros_presenca")
    .select(
      "id, colaborador_id, filial_id, tipo, status, data_referencia, horario_registrado, latitude, longitude, colaboradores(nome), filiais(nome)"
    )
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .gte("horario_registrado", desde)
    .order("horario_registrado", { ascending: false })
    .limit(500);

  if (error) throw error;

  type LinhaBruta = Omit<RegistroPresenca, "colaborador_nome" | "filial_nome" | "colaborador_matricula"> & {
    colaboradores: { nome: string } | null;
    filiais: { nome: string } | null;
  };

  // O cliente Supabase não infere o tipo do join a partir da string do select
  // (database.types.ts é um placeholder sem Relationships reais); o formato
  // da linha é garantido pela query acima.
  return ((data ?? []) as unknown as LinhaBruta[]).map((row) => ({
    ...row,
    colaborador_nome: row.colaboradores?.nome,
    filial_nome: row.filiais?.nome,
  }));
}

/** Ranking de líderes por volume de decisões e SLA de aprovação (view vw_sla_lideres). */
export async function listarRankingLideres(): Promise<SlaLider[]> {
  const { data, error } = await supabase
    .from("vw_sla_lideres")
    .select("*")
    .order("pct_dentro_sla", { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data as SlaLider[];
}

interface FiltroAuditoria {
  entidade?: string;
  de?: string; // ISO date
  ate?: string; // ISO date
}

/** Log de auditoria, mais recente primeiro, com filtro opcional por entidade/período. */
export async function listarAuditoria(filtro: FiltroAuditoria = {}): Promise<AuditLogEntry[]> {
  let query = supabase
    .from("audit_log")
    .select("id, ator_id, acao, entidade, entidade_id, detalhes, created_at, perfis(nome)")
    .order("created_at", { ascending: false })
    .limit(500);

  if (filtro.entidade) query = query.eq("entidade", filtro.entidade);
  if (filtro.de) query = query.gte("created_at", filtro.de);
  if (filtro.ate) query = query.lte("created_at", filtro.ate);

  const { data, error } = await query;
  if (error) throw error;

  type LinhaBruta = Omit<AuditLogEntry, "ator_nome"> & { perfis: { nome: string } | null };

  return ((data ?? []) as unknown as LinhaBruta[]).map((row) => ({
    ...row,
    ator_nome: row.perfis?.nome ?? "Sistema",
  }));
}

/** Lista de filiais, usada nos seletores de mapa/hierarquia/usuários. */
export async function listarFiliais(): Promise<Filial[]> {
  const { data, error } = await supabase.from("filiais").select("*").order("nome");
  if (error) throw error;
  return data as Filial[];
}

/** Usuários do sistema com sua filial "home" e as filiais que gerenciam (se gestor). */
export async function listarUsuarios(): Promise<UsuarioComHierarquia[]> {
  const { data, error } = await supabase
    .from("perfis")
    .select(
      "id, nome, email, perfil, filial_id, ativo, coordenador_id, filiais(nome), gestor_filiais(filial_id, filiais(id, nome)), coordenador:perfis!coordenador_id(nome)"
    )
    .order("nome");

  if (error) throw error;

  interface LinhaBruta {
    id: string;
    nome: string;
    email: string;
    perfil: UsuarioComHierarquia["perfil"];
    filial_id: string | null;
    ativo: boolean;
    coordenador_id: string | null;
    filiais: { nome: string } | null;
    coordenador: { nome: string } | null;
    gestor_filiais: { filiais: { id: string; nome: string } }[] | null;
  }

  return ((data ?? []) as unknown as LinhaBruta[]).map((row) => ({
    id: row.id,
    nome: row.nome,
    email: row.email,
    perfil: row.perfil,
    filial_id: row.filial_id,
    ativo: row.ativo,
    coordenador_id: row.coordenador_id,
    filial_home_nome: row.filiais?.nome ?? null,
    coordenador_nome: row.coordenador?.nome ?? null,
    filiais_gerenciadas: (row.gestor_filiais ?? []).map((gf) => ({
      id: gf.filiais.id,
      nome: gf.filiais.nome,
    })),
  }));
}

export interface PessoaSimples {
  id: string;
  nome: string;
}

/** Líderes (perfil=gestor) ativos — usado no seletor "líder direto" ao criar colaborador. */
export async function listarLideres(): Promise<PessoaSimples[]> {
  const { data, error } = await supabase
    .from("perfis")
    .select("id, nome")
    .eq("perfil", "gestor")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data ?? []) as PessoaSimples[];
}

/** Coordenadores ativos — usado no seletor "coordenador direto" ao criar líder. */
export async function listarCoordenadores(): Promise<PessoaSimples[]> {
  const { data, error } = await supabase
    .from("perfis")
    .select("id, nome")
    .eq("perfil", "coordenador")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data ?? []) as PessoaSimples[];
}

export async function atualizarPapelUsuario(
  id: string,
  perfil: UsuarioComHierarquia["perfil"],
  filialId: string | null
) {
  const { error } = await supabase.from("perfis").update({ perfil, filial_id: filialId }).eq("id", id);
  if (error) throw error;
}

export async function ativarDesativarUsuario(id: string, ativo: boolean) {
  const { error } = await supabase.from("perfis").update({ ativo }).eq("id", id);
  if (error) throw error;
}

export async function atribuirFilialGestor(gestorId: string, filialId: string) {
  const { error } = await supabase.from("gestor_filiais").insert({ gestor_id: gestorId, filial_id: filialId });
  if (error) throw error;
}

export async function removerFilialGestor(gestorId: string, filialId: string) {
  const { error } = await supabase
    .from("gestor_filiais")
    .delete()
    .eq("gestor_id", gestorId)
    .eq("filial_id", filialId);
  if (error) throw error;
}

export interface NovoUsuarioInput {
  nome: string;
  email: string;
  perfil: UsuarioComHierarquia["perfil"];
  filial_id?: string | null;
  filiais_gerenciadas?: string[];
  /** Coordenador direto — só relevante quando perfil = 'gestor' e quem cria é admin (coordenador vira o próprio automaticamente). */
  coordenador_id?: string | null;
}

/** Cria um novo usuário via Edge Function (precisa de service_role para o Admin API). */
export async function criarUsuario(input: NovoUsuarioInput) {
  const { data, error } = await supabase.functions.invoke("admin-criar-usuario", { body: input });
  if (error) throw error;
  if (data?.error) throw new Error(data.mensagem ?? "Não foi possível criar o usuário.");
  return data as { ok: true; usuario_id: string; senha_inicial: string };
}
