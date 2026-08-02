-- =========================================================
-- 0017 · Módulo 5 — Calendário operacional
--
-- A tabela guarda apenas as EXCEÇÕES à regra natural do dia da semana
-- (feriados, e eventuais pontos facultativos/dias úteis excepcionais).
-- Dias comuns (útil/sábado/domingo) são derivados do dia da semana via
-- tlp_presenca.tipo_dia_calendario(data), sem precisar popular todos os dias
-- do ano na tabela.
-- =========================================================

create type tlp_presenca.tipo_dia as enum ('UTIL', 'SABADO', 'DOMINGO', 'FERIADO');

create table tlp_presenca.calendario (
  data        date primary key,
  tipo        tlp_presenca.tipo_dia not null,
  descricao   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table tlp_presenca.calendario is
  'Exceções ao calendário natural (feriados nacionais/estaduais/municipais e eventuais ajustes manuais). Dias sem registro aqui são classificados por dia da semana.';

create trigger calendario_set_updated_at
  before update on tlp_presenca.calendario
  for each row execute function tlp_presenca.set_updated_at();

-- ---------------------------------------------------------
-- Classificação de um dia: UTIL | SABADO | DOMINGO | FERIADO
-- Prioridade: exceção cadastrada em tlp_presenca.calendario > dia da semana.
-- ---------------------------------------------------------
create or replace function tlp_presenca.tipo_dia_calendario(p_data date)
returns tlp_presenca.tipo_dia
language sql
stable
as $$
  select coalesce(
    (select c.tipo from tlp_presenca.calendario c where c.data = p_data),
    case extract(dow from p_data)::int
      when 0 then 'DOMINGO'::tlp_presenca.tipo_dia
      when 6 then 'SABADO'::tlp_presenca.tipo_dia
      else 'UTIL'::tlp_presenca.tipo_dia
    end
  );
$$;

comment on function tlp_presenca.tipo_dia_calendario(date) is
  'Classifica uma data como UTIL/SABADO/DOMINGO/FERIADO, considerando exceções cadastradas em tlp_presenca.calendario.';

-- ---------------------------------------------------------
-- RLS
-- ---------------------------------------------------------
alter table tlp_presenca.calendario enable row level security;

create policy "calendario_select_autenticados"
  on tlp_presenca.calendario for select
  to authenticated
  using (true); -- calendário é referência básica, visível a todo usuário logado

create policy "calendario_insert_admin"
  on tlp_presenca.calendario for insert
  to authenticated
  with check (tlp_presenca.sou_admin());

create policy "calendario_update_admin"
  on tlp_presenca.calendario for update
  to authenticated
  using (tlp_presenca.sou_admin())
  with check (tlp_presenca.sou_admin());

create policy "calendario_delete_admin"
  on tlp_presenca.calendario for delete
  to authenticated
  using (tlp_presenca.sou_admin());

-- ---------------------------------------------------------
-- Seed inicial: feriados nacionais 2025-2026
-- (datas móveis calculadas a partir da Páscoa; confirme com o calendário
--  oficial do ano corrente antes de ir para produção — ajustes pontuais
--  como feriados municipais/estaduais devem ser inseridos manualmente)
-- ---------------------------------------------------------
insert into tlp_presenca.calendario (data, tipo, descricao) values
  -- 2025
  ('2025-01-01', 'FERIADO', 'Confraternização Universal'),
  ('2025-03-03', 'FERIADO', 'Carnaval'),
  ('2025-03-04', 'FERIADO', 'Carnaval'),
  ('2025-04-18', 'FERIADO', 'Sexta-feira Santa'),
  ('2025-04-21', 'FERIADO', 'Tiradentes'),
  ('2025-05-01', 'FERIADO', 'Dia do Trabalho'),
  ('2025-06-19', 'FERIADO', 'Corpus Christi'),
  ('2025-09-07', 'FERIADO', 'Independência do Brasil'),
  ('2025-10-12', 'FERIADO', 'Nossa Senhora Aparecida'),
  ('2025-11-02', 'FERIADO', 'Finados'),
  ('2025-11-15', 'FERIADO', 'Proclamação da República'),
  ('2025-11-20', 'FERIADO', 'Consciência Negra'),
  ('2025-12-25', 'FERIADO', 'Natal'),
  -- 2026
  ('2026-01-01', 'FERIADO', 'Confraternização Universal'),
  ('2026-02-16', 'FERIADO', 'Carnaval'),
  ('2026-02-17', 'FERIADO', 'Carnaval'),
  ('2026-04-03', 'FERIADO', 'Sexta-feira Santa'),
  ('2026-04-21', 'FERIADO', 'Tiradentes'),
  ('2026-05-01', 'FERIADO', 'Dia do Trabalho'),
  ('2026-06-04', 'FERIADO', 'Corpus Christi'),
  ('2026-09-07', 'FERIADO', 'Independência do Brasil'),
  ('2026-10-12', 'FERIADO', 'Nossa Senhora Aparecida'),
  ('2026-11-02', 'FERIADO', 'Finados'),
  ('2026-11-15', 'FERIADO', 'Proclamação da República'),
  ('2026-11-20', 'FERIADO', 'Consciência Negra'),
  ('2026-12-25', 'FERIADO', 'Natal')
on conflict (data) do nothing;
