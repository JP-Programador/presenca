-- =========================================================
-- 0007 · Agendamento (pg_cron) da limpeza de fotos com 48h
--
-- A cada 30 min, chama a Edge Function 'delete-old-photos' via pg_net.
-- Substitua SEU_PROJETO e SERVICE_ROLE_KEY pelos valores reais do projeto
-- (idealmente via Vault/secrets do Supabase, não hardcoded em produção).
--
-- Nome do job prefixado com "tlp-": cron.job é uma tabela de instância,
-- compartilhada entre todos os projetos que rodam nesse mesmo banco — sem
-- o prefixo, o nome genérico poderia colidir com o job de outro projeto.
-- =========================================================

select cron.schedule(
  'tlp-delete-old-photos-48h',   -- nome do job
  '*/30 * * * *',                -- a cada 30 minutos
  $$
  select net.http_post(
    url := 'https://SEU_PROJETO.supabase.co/functions/v1/delete-old-photos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Para remover o agendamento, se necessário:
-- select cron.unschedule('tlp-delete-old-photos-48h');
