-- =========================================================
-- 0003 · Índices
-- =========================================================

-- necessário para o índice gin de busca por nome (trigram)
create extension if not exists pg_trgm;

-- filiais
create index idx_filiais_ativo on tlp_presenca.filiais (ativo);

-- perfis
create index idx_perfis_filial_id on tlp_presenca.perfis (filial_id);
create index idx_perfis_perfil on tlp_presenca.perfis (perfil);

-- gestor_filiais
create index idx_gestor_filiais_filial_id on tlp_presenca.gestor_filiais (filial_id);

-- colaboradores
create index idx_colaboradores_filial_id on tlp_presenca.colaboradores (filial_id);
create index idx_colaboradores_perfil_id on tlp_presenca.colaboradores (perfil_id);
create index idx_colaboradores_ativo on tlp_presenca.colaboradores (ativo);
create index idx_colaboradores_nome_trgm on tlp_presenca.colaboradores using gin (nome gin_trgm_ops);

-- escalas
create index idx_escalas_colaborador_id on tlp_presenca.escalas (colaborador_id);

-- registros_presenca (tabela de maior volume/consulta)
create index idx_registros_colaborador_id on tlp_presenca.registros_presenca (colaborador_id);
create index idx_registros_filial_id on tlp_presenca.registros_presenca (filial_id);
create index idx_registros_data_referencia on tlp_presenca.registros_presenca (data_referencia);
create index idx_registros_status on tlp_presenca.registros_presenca (status);
create index idx_registros_colaborador_data on tlp_presenca.registros_presenca (colaborador_id, data_referencia);
-- acelera a rotina de limpeza: só varre registros com foto pendente de expiração
create index idx_registros_foto_expira_em on tlp_presenca.registros_presenca (foto_expira_em)
  where foto_path is not null;

-- justificativas
create index idx_justificativas_colaborador_id on tlp_presenca.justificativas (colaborador_id);
create index idx_justificativas_registro_id on tlp_presenca.justificativas (registro_id);
create index idx_justificativas_status on tlp_presenca.justificativas (status);

-- audit_log
create index idx_audit_log_entidade on tlp_presenca.audit_log (entidade, entidade_id);
create index idx_audit_log_created_at on tlp_presenca.audit_log (created_at);
