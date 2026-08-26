-- =========================================================
-- 0066 · Agenda os 6 disparos de notificação push
--
-- Líder: 08:00/08:30/09:00 BRT (lembrete) e 09:15 BRT (final, já em FALTA).
-- Coordenador: 08:30 BRT (lembrete) e 09:15 BRT (final).
-- pg_cron roda em UTC — Brasil é UTC-3 (sem horário de verão hoje em dia),
-- então os horários abaixo são +3h dos horários reais em BRT. Só dias
-- úteis (seg-sex) no padrão do cron; feriado no meio da semana é filtrado
-- dentro da própria Edge Function (tipo_dia_calendario).
--
-- URL/segredo passados por parâmetro (nunca hardcoded aqui) — mesma
-- lógica já usada pra reagendar o cron de limpeza de fotos (migration 0043).
-- =========================================================

create or replace function tlp_presenca.agendar_cron_notificacoes_push(
  p_project_url text,
  p_push_secret text
)
returns void
language plpgsql
security definer
set search_path = tlp_presenca, cron, net
as $$
declare
  v_base_url text := p_project_url || '/functions/v1/enviar-notificacoes-push';
begin
  perform cron.unschedule(nome)
  from unnest(array[
    'tlp-push-lider-0800', 'tlp-push-lider-0830', 'tlp-push-lider-0900', 'tlp-push-lider-0915',
    'tlp-push-coordenador-0830', 'tlp-push-coordenador-0915'
  ]) as nome
  where exists (select 1 from cron.job where jobname = nome);

  perform cron.schedule('tlp-push-lider-0800', '0 11 * * 1-5',
    format($cmd$ select net.http_post(url := %L); $cmd$, v_base_url || '?secret=' || p_push_secret || '&publico=lider&fase=lembrete'));

  perform cron.schedule('tlp-push-lider-0830', '30 11 * * 1-5',
    format($cmd$ select net.http_post(url := %L); $cmd$, v_base_url || '?secret=' || p_push_secret || '&publico=lider&fase=lembrete'));

  perform cron.schedule('tlp-push-lider-0900', '0 12 * * 1-5',
    format($cmd$ select net.http_post(url := %L); $cmd$, v_base_url || '?secret=' || p_push_secret || '&publico=lider&fase=lembrete'));

  perform cron.schedule('tlp-push-lider-0915', '15 12 * * 1-5',
    format($cmd$ select net.http_post(url := %L); $cmd$, v_base_url || '?secret=' || p_push_secret || '&publico=lider&fase=final'));

  perform cron.schedule('tlp-push-coordenador-0830', '30 11 * * 1-5',
    format($cmd$ select net.http_post(url := %L); $cmd$, v_base_url || '?secret=' || p_push_secret || '&publico=coordenador&fase=lembrete'));

  perform cron.schedule('tlp-push-coordenador-0915', '15 12 * * 1-5',
    format($cmd$ select net.http_post(url := %L); $cmd$, v_base_url || '?secret=' || p_push_secret || '&publico=coordenador&fase=final'));
end;
$$;

comment on function tlp_presenca.agendar_cron_notificacoes_push(text, text) is
  'Uso único (setup) — agenda os 6 cron jobs de notificação push, recebendo URL/segredo por parâmetro pra nunca ficarem hardcoded no repositório.';
