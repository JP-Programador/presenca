-- =========================================================
-- 0048 · Papel "gerente"
--
-- ALTER TYPE ... ADD VALUE não pode ser usado na mesma transação em que o
-- novo valor é referenciado — por isso fica isolado, mesmo padrão da 0008.
-- =========================================================

alter type tlp_presenca.perfil_acesso add value if not exists 'gerente';

comment on type tlp_presenca.perfil_acesso is
  'admin: acesso total, inclusive configuração de sistema. gerente: como admin na operação (vê/gerencia todos os coordenadores e hierarquias abaixo), sem mexer em filiais/calendário/exclusão de perfis/auditoria. coordenador: leitura e gestão só da própria hierarquia (líderes que criou + colaboradores deles). gestor: restrito aos próprios colaboradores. colaborador: restrito aos próprios registros.';
