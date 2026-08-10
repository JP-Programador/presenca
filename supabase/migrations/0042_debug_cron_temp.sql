-- Temporário: diagnosticar se o job de limpeza de fotos está configurado
-- corretamente (a migration 0007 tinha placeholders SEU_PROJETO/SERVICE_ROLE_KEY
-- que precisavam ser substituídos manualmente ao aplicar). Removido logo em
-- seguida por uma migration de limpeza.
create or replace function tlp_presenca.debug_cron_status()
returns table(jobid bigint, jobname text, schedule text, active boolean, command text)
language sql
security definer
set search_path = tlp_presenca, cron
as $$
  select jobid, jobname, schedule, active, command from cron.job where jobname like 'tlp-%';
$$;
