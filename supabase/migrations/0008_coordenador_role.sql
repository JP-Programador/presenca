-- =========================================================
-- 0008 · Papel de coordenador/gerente
--
-- ALTER TYPE ... ADD VALUE não pode ser usado na mesma transação em que o
-- novo valor é referenciado — por isso fica isolado nesta migration.
-- =========================================================

alter type tlp_presenca.perfil_acesso add value if not exists 'coordenador';

comment on type tlp_presenca.perfil_acesso is
  'admin: acesso total. coordenador: leitura de todas as filiais + gestão de usuários/hierarquia, sem RBAC de admin puro. gestor: restrito às filiais atribuídas. colaborador: restrito aos próprios registros.';
