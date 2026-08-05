-- =========================================================
-- 0034 · Rate limiting para Edge Functions públicas
--
-- checkin-publico, marcacao-publica e validar-colaborador não exigem login
-- (verify_jwt = false) e identificam a pessoa só por filial + 4 dígitos da
-- matrícula — 10.000 combinações, força-bruta viável sem limite de
-- tentativas. Essa tabela + função guardam, por IP + endpoint, quantas
-- chamadas ocorreram numa janela de tempo; check_rate_limit incrementa e
-- devolve false quando o limite da janela é excedido, de forma atômica
-- (evita race condition entre leitura e escrita sob concorrência).
-- =========================================================

create table if not exists tlp_presenca.rate_limits (
  chave text primary key,
  contagem integer not null default 1,
  inicio_janela timestamptz not null default now()
);

alter table tlp_presenca.rate_limits enable row level security;

create or replace function tlp_presenca.check_rate_limit(
  p_chave text,
  p_max_tentativas integer,
  p_janela_segundos integer
) returns boolean
language plpgsql
security definer
set search_path = tlp_presenca
as $$
declare
  v_permitido boolean;
begin
  insert into rate_limits (chave, contagem, inicio_janela)
  values (p_chave, 1, now())
  on conflict (chave) do update
    set contagem = case
          when rate_limits.inicio_janela < now() - (p_janela_segundos || ' seconds')::interval
            then 1
          else rate_limits.contagem + 1
        end,
        inicio_janela = case
          when rate_limits.inicio_janela < now() - (p_janela_segundos || ' seconds')::interval
            then now()
          else rate_limits.inicio_janela
        end
  returning (contagem <= p_max_tentativas) into v_permitido;

  return v_permitido;
end;
$$;

revoke all on function tlp_presenca.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function tlp_presenca.check_rate_limit(text, integer, integer) to service_role;
