-- =========================================================
-- 0037 · Reset do sistema para estado "virgem"
--
-- Apaga todo o histórico operacional e todos os usuários exceto o admin
-- informado. Mantém a filial cadastrada (24 · Lapa) e a conta de admin.
--
-- Ordem aproveitando os ON DELETE CASCADE já existentes:
--   1) colaboradores -> cascade em registros_presenca, justificativas,
--      status_dia, marcacoes_dia, escalas.
--   2) calendario -> tabela independente, limpa à parte.
--   3) audit_log -> ator_id é ON DELETE SET NULL (não cascade), limpa à parte.
--   4) auth.users (exceto admin) -> cascade em perfis -> cascade em
--      gestor_filiais.
--
-- Trava de segurança: aborta a migration inteira (rollback automático) se
-- não encontrar exatamente 1 usuário com esse e-mail e perfil='admin' —
-- evita apagar todo mundo por um e-mail digitado errado.
-- =========================================================

do $$
declare
  v_admin_id uuid;
begin
  select p.id into v_admin_id
  from tlp_presenca.perfis p
  where p.email = 'joaopedrosilvadossantos2003@gmail.com'
    and p.perfil = 'admin';

  if v_admin_id is null then
    raise exception 'Admin joaopedrosilvadossantos2003@gmail.com (perfil=admin) não encontrado — abortando reset por segurança.';
  end if;

  delete from tlp_presenca.colaboradores;
  delete from tlp_presenca.calendario;
  delete from tlp_presenca.audit_log;

  delete from auth.users where id <> v_admin_id;
end $$;
