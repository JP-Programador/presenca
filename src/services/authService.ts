import { supabase } from "@/services/supabaseClient";
import type { PerfilUsuario } from "@/types/domain";

/** Busca a sessão atual (se houver) diretamente do Supabase Auth. */
export async function obterSessaoAtual() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Carrega o perfil (papel de acesso, filial) vinculado a um usuário autenticado. */
export async function buscarPerfil(userId: string): Promise<PerfilUsuario | null> {
  const { data, error } = await supabase
    .from("perfis")
    .select("id, nome, email, perfil, filial_id, coordenador_id, senha_temporaria")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data as PerfilUsuario;
}

/** Assina mudanças de sessão (login/logout/refresh de token). */
export function assinarMudancasDeSessao(callback: (userId: string | null) => void) {
  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user.id ?? null);
  });
  return () => listener.subscription.unsubscribe();
}

/** Registra um evento de auditoria sem tabela própria (login/logout/reset de senha). Nunca lança — auditoria não pode travar o fluxo do usuário. */
async function registrarEventoAuditoria(acao: "login" | "logout" | "senha_redefinida_solicitada", entidadeId?: string) {
  try {
    const { data } = await supabase.auth.getUser();
    const atorId = data.user?.id;
    if (!atorId) return;
    await supabase
      .from("audit_log")
      .insert({ ator_id: atorId, acao, entidade: "perfis", entidade_id: entidadeId ?? atorId, detalhes: null });
  } catch (err) {
    console.error("Falha ao registrar evento de auditoria:", err);
  }
}

export async function entrarComSenha(email: string, senha: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (!error) await registrarEventoAuditoria("login");
  return { error: error?.message ?? null };
}

export async function sairDaSessao() {
  await registrarEventoAuditoria("logout"); // precisa rodar ANTES do signOut, enquanto auth.uid() ainda existe
  await supabase.auth.signOut();
}

/** Dispara o e-mail de redefinição de senha para o usuário (fluxo padrão do Supabase Auth). */
export async function solicitarRedefinicaoSenha(email: string, usuarioId?: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (!error) await registrarEventoAuditoria("senha_redefinida_solicitada", usuarioId);
  return { error: error?.message ?? null };
}

/** Troca a senha do usuário logado e derruba a flag senha_temporaria (força de troca no 1º acesso). */
export async function definirNovaSenha(novaSenha: string, userId: string) {
  const { error: erroSenha } = await supabase.auth.updateUser({ password: novaSenha });
  if (erroSenha) return { error: erroSenha.message };

  const { error: erroFlag } = await supabase.from("perfis").update({ senha_temporaria: false }).eq("id", userId);
  return { error: erroFlag?.message ?? null };
}
