-- =========================================================
-- 0031 · Promove EMAIL_REDIGIDO a admin
-- (senha do admin original foi esquecida)
-- =========================================================

update tlp_presenca.perfis
set perfil = 'admin'
where email = 'EMAIL_REDIGIDO';
