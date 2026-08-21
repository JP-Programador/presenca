-- =========================================================
-- 0054 · foto_path de marcacoes_atendimento precisa aceitar null
--
-- delete-old-photos zera a referência da foto depois de expirar (mesmo
-- padrão de registros_presenca.foto_path) — a coluna nasceu "not null"
-- na 0053 por engano, o que impede exatamente essa limpeza.
-- =========================================================

alter table tlp_presenca.marcacoes_atendimento
  alter column foto_path drop not null;
