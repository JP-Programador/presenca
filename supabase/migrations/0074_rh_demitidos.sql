-- =========================================================
-- 0074 · Demitidos do RH (lembrete na tela de colaboradores)
--
-- Espelho da base de RH (TLP.xlsx), só com quem tem data de demissão.
-- Carregada por scripts/gerar-sql-demitidos.mjs (SQL rodado no SQL Editor).
-- Só leitura pro app: sem policy de escrita (service_role/SQL Editor ignoram RLS).
-- =========================================================

create table tlp_presenca.rh_demitidos (
  matricula_norm text not null,          -- matrícula sem zeros à esquerda
  nome           text not null,
  data_demissao  date not null,
  filial_rh      text,
  primary key (matricula_norm, data_demissao)
);

alter table tlp_presenca.rh_demitidos enable row level security;

create policy "rh_demitidos_select_autenticados"
  on tlp_presenca.rh_demitidos for select
  to authenticated
  using (true);

grant select on tlp_presenca.rh_demitidos to authenticated;
