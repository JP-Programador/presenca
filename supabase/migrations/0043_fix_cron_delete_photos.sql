-- =========================================================
-- 0043 · Corrige o job de limpeza de fotos (nunca funcionou)
--
-- A migration 0007 criou o job com placeholders literais
-- (SEU_PROJETO.supabase.co / Bearer SERVICE_ROLE_KEY) que precisavam ser
-- substituídos manualmente ao aplicar em produção — nunca foram. O job
-- rodava a cada 30 min há semanas, sempre falhando (URL inexistente),
-- então nenhuma foto jamais foi apagada automaticamente.
--
-- Função auxiliar que recebe a URL do projeto e a service_role key como
-- parâmetro (nunca hardcoded aqui) e reagenda o job. Chamada uma única vez
-- por uma Edge Function temporária que já tem essas duas informações no
-- próprio ambiente (Deno.env) — a chave real nunca precisa aparecer em
-- nenhum arquivo do repositório.
-- =========================================================

create or replace function tlp_presenca.reagendar_cron_delete_photos(
  p_project_url text,
  p_service_role_key text
)
returns void
language plpgsql
security definer
set search_path = tlp_presenca, cron, net
as $$
begin
  perform cron.unschedule('tlp-delete-old-photos-48h');

  perform cron.schedule(
    'tlp-delete-old-photos-24h',
    '*/30 * * * *',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := '{}'::jsonb
      );
      $cmd$,
      p_project_url || '/functions/v1/delete-old-photos',
      p_service_role_key
    )
  );
end;
$$;

comment on function tlp_presenca.reagendar_cron_delete_photos(text, text) is
  'Uso único (correção do job criado com placeholders na 0007) — reagenda tlp-delete-old-photos com a URL/chave reais, recebidas por parâmetro pra nunca ficarem hardcoded no repositório.';
