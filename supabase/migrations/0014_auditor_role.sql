-- =========================================================
-- 0014 · Papel de auditor + reajuste da hierarquia
--
-- Hierarquia final:
--   admin        > tudo: lê tudo, aprova/rejeita tudo, gerencia usuários/hierarquia
--   auditor      = mesma leitura global do admin (todas as filiais, audit_log,
--                   usuários), mas SEM nenhuma permissão de escrita — papel
--                   puramente de fiscalização
--   coordenador  < admin: lê tudo e aprova/rejeita presença em qualquer filial
--                   (mesmo que antes), mas deixou de poder gerenciar
--                   usuários/hierarquia — isso agora é exclusivo do admin
--   gestor       restrito às filiais em gestor_filiais (sem alteração)
--   colaborador  restrito aos próprios registros (sem alteração)
--
-- ALTER TYPE ... ADD VALUE fica isolado nesta migration (não pode ser usado
-- na mesma transação em que o novo valor é referenciado).
-- =========================================================

alter type tlp_presenca.perfil_acesso add value if not exists 'auditor';

comment on type tlp_presenca.perfil_acesso is
  'admin: acesso total. auditor: leitura global igual ao admin, sem nenhuma escrita. coordenador: leitura global + aprova/rejeita presença, mas não gerencia usuários/hierarquia. gestor: restrito às filiais atribuídas. colaborador: restrito aos próprios registros.';
