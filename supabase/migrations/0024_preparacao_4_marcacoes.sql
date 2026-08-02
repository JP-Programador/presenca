-- =========================================================
-- 0024 · Módulo 13 — Banco para 4 marcações diárias
--
-- Schema para o fluxo de 4 marcações por dia (ENTRADA / ALMOCO_SAIDA /
-- ALMOCO_RETORNO / FINALIZACAO). A tela pública opcional (`/ponto4`,
-- Edge Function `marcacao-publica`) foi adicionada depois, sem alterar
-- nada aqui — `registros_presenca.tipo` (enum antigo, usado por `/` e
-- `/ponto`) continua inalterado e funcionando em paralelo.
-- =========================================================

create type tlp_presenca.tipo_marcacao_dia as enum (
  'ENTRADA', 'ALMOCO_SAIDA', 'ALMOCO_RETORNO', 'FINALIZACAO'
);

create table tlp_presenca.marcacoes_dia (
  id                uuid primary key default gen_random_uuid(),
  colaborador_id    uuid not null references tlp_presenca.colaboradores(id) on delete cascade,
  filial_id         uuid not null references tlp_presenca.filiais(id) on delete restrict,
  data_referencia   date not null,
  tipo              tlp_presenca.tipo_marcacao_dia not null,
  horario_registrado timestamptz not null default now(),
  latitude          double precision,
  longitude         double precision,
  precisao_metros   double precision,
  foto_path         text,
  foto_expira_em    timestamptz,
  observacao        text,
  created_at        timestamptz not null default now(),

  constraint marcacoes_dia_colaborador_data_tipo_unique unique (colaborador_id, data_referencia, tipo)
);

comment on table tlp_presenca.marcacoes_dia is
  'Preparação para o fluxo de 4 marcações diárias (ENTRADA/ALMOCO_SAIDA/ALMOCO_RETORNO/FINALIZACAO) — ainda sem tela própria; hoje só registros_presenca.tipo (1 marcação por vez) é usado em produção.';

create index marcacoes_dia_colaborador_data_idx on tlp_presenca.marcacoes_dia (colaborador_id, data_referencia);

create trigger trg_marcacoes_dia_foto_expira
  before insert or update of foto_path on tlp_presenca.marcacoes_dia
  for each row execute function tlp_presenca.set_foto_expira_em();

alter table tlp_presenca.marcacoes_dia enable row level security;

create policy "marcacoes_dia_select"
  on tlp_presenca.marcacoes_dia for select
  to authenticated
  using (
    tlp_presenca.visao_global()
    or tlp_presenca.gerencio_filial(filial_id)
    or colaborador_id = tlp_presenca.meu_colaborador_id()
  );

create policy "marcacoes_dia_insert"
  on tlp_presenca.marcacoes_dia for insert
  to authenticated
  with check (
    tlp_presenca.sou_admin()
    or tlp_presenca.gerencio_filial(filial_id)
    or colaborador_id = tlp_presenca.meu_colaborador_id()
  );

create policy "marcacoes_dia_update_gestor"
  on tlp_presenca.marcacoes_dia for update
  to authenticated
  using (tlp_presenca.sou_admin() or tlp_presenca.gerencio_filial(filial_id))
  with check (tlp_presenca.sou_admin() or tlp_presenca.gerencio_filial(filial_id));

create policy "marcacoes_dia_delete_admin"
  on tlp_presenca.marcacoes_dia for delete
  to authenticated
  using (tlp_presenca.sou_admin());
