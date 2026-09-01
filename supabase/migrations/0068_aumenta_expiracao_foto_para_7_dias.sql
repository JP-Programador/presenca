-- =========================================================
-- 0068 · Aumenta retenção de foto de 24h para 7 dias
--
-- Pedido do usuário: com 200 colaboradores batendo entrada+saída, 7 dias
-- de foto dá ~960MB/mês no pior caso (calculado com o tamanho real médio
-- das fotos hoje, ~80KB) -- ainda cabe com folga no plano free do
-- Supabase (1GB), diferente de 30 dias que tomaria quase o limite inteiro.
--
-- Mesma função usada pelos triggers de registros_presenca e
-- marcacoes_atendimento — muda as duas de uma vez. Recalcula também as
-- fotos que ainda não expiraram, pra valer imediatamente.
-- =========================================================

create or replace function tlp_presenca.set_foto_expira_em()
returns trigger
language plpgsql
as $$
begin
  if new.foto_path is not null then
    new.foto_expira_em := new.horario_registrado + interval '7 days';
  end if;
  return new;
end;
$$;

comment on function tlp_presenca.set_foto_expira_em() is
  'Define foto_expira_em = horario_registrado + 7 dias (usado pela Edge Function delete-old-photos).';

update tlp_presenca.registros_presenca
set foto_expira_em = horario_registrado + interval '7 days'
where foto_path is not null and foto_expira_em is not null;

update tlp_presenca.marcacoes_atendimento
set foto_expira_em = horario_registrado + interval '7 days'
where foto_path is not null and foto_expira_em is not null;
