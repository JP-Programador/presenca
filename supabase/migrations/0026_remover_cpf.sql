-- =========================================================
-- 0026 · Remove CPF do cadastro de colaboradores
--
-- Desde a mudança de identificação na tela pública (código da filial + 4
-- últimos dígitos da matrícula, substituindo matrícula + 4 dígitos do CPF),
-- o CPF deixou de ser usado em qualquer fluxo do sistema. A pedido, a
-- coluna é removida por completo — menos um dado sensível guardado.
-- =========================================================

alter table tlp_presenca.colaboradores drop column cpf;
