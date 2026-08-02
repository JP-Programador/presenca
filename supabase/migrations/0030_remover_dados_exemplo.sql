-- =========================================================
-- 0030 · Remove filiais e colaboradores de exemplo do seed
--
-- Colaboradores primeiro (registros_presenca/status_dia/marcacoes_dia/
-- escalas/justificativas ligados a eles saem em cascata), depois as
-- filiais (colaboradores.filial_id é ON DELETE RESTRICT).
-- =========================================================

delete from tlp_presenca.colaboradores
where filial_id in (select id from tlp_presenca.filiais where codigo in ('1768', '2210', '3005'));

delete from tlp_presenca.filiais where codigo in ('1768', '2210', '3005');
