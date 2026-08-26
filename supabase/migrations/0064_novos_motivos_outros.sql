-- =========================================================
-- 0064 · Novos motivos pra status OUTROS (estudo de siglas do usuário)
--
-- Frota, Exame periódico, Bloqueado IHS e Base entram como motivos dentro
-- do status genérico OUTROS — mesmo mecanismo já usado por Férias/
-- Afastamento/etc., sem mudar a máquina de estados nem exigir tabela nova.
-- =========================================================

alter type tlp_presenca.motivo_outros_enum add value 'Frota';
alter type tlp_presenca.motivo_outros_enum add value 'Exame periódico';
alter type tlp_presenca.motivo_outros_enum add value 'Bloqueado IHS';
alter type tlp_presenca.motivo_outros_enum add value 'Base';
