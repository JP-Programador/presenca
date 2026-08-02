-- =========================================================
-- 0009 · Colunas de SLA (quem/quando decidiu um registro de presença)
--
-- justificativas já tinha analisado_por/analisado_em (migration 0002).
-- registros_presenca precisa do mesmo par para medir SLA de aprovação.
-- =========================================================

alter table tlp_presenca.registros_presenca
  add column analisado_por uuid references tlp_presenca.perfis(id) on delete set null,
  add column analisado_em  timestamptz;

create index idx_registros_analisado_por on tlp_presenca.registros_presenca (analisado_por);

comment on column tlp_presenca.registros_presenca.analisado_por is
  'Gestor/coordenador que aprovou ou rejeitou o registro (quando status sai de pendente_aprovacao).';
comment on column tlp_presenca.registros_presenca.analisado_em is
  'Timestamp da decisão — usado para calcular o SLA de aprovação por líder.';
