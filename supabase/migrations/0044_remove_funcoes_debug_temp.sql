-- =========================================================
-- 0044 · Remove as funções temporárias de diagnóstico/correção do cron
--
-- debug_cron_status() (0042) e reagendar_cron_delete_photos() (0043)
-- cumpriram o papel: confirmar que o job de limpeza de fotos estava
-- quebrado e reagendá-lo com a URL/chave reais. debug_cron_status()
-- expõe o comando completo do job — incluindo a service_role key em texto
-- puro — pra quem tiver EXECUTE nela, então não deve continuar disponível.
-- =========================================================

drop function if exists tlp_presenca.debug_cron_status();
drop function if exists tlp_presenca.reagendar_cron_delete_photos(text, text);
