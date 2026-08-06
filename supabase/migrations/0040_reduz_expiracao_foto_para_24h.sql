-- =========================================================
-- 0040 · Reduz retenção de foto de 48h para 24h
--
-- tlp_presenca.set_foto_expira_em() é usada pelos triggers de
-- registros_presenca (0004) e marcacoes_dia (0024) — muda as duas de uma
-- vez só trocando a função. Recalcula também foto_expira_em das fotos já
-- existentes (que ainda não expiraram), pra a mudança valer imediatamente
-- em vez de só nos check-ins novos.
-- =========================================================

create or replace function tlp_presenca.set_foto_expira_em()
returns trigger
language plpgsql
as $$
begin
  if new.foto_path is not null then
    new.foto_expira_em := new.horario_registrado + interval '24 hours';
  end if;
  return new;
end;
$$;

comment on function tlp_presenca.set_foto_expira_em() is
  'Define foto_expira_em = horario_registrado + 24h (usado pela Edge Function delete-old-photos).';

update tlp_presenca.registros_presenca
set foto_expira_em = horario_registrado + interval '24 hours'
where foto_path is not null;

update tlp_presenca.marcacoes_dia
set foto_expira_em = horario_registrado + interval '24 hours'
where foto_path is not null;
