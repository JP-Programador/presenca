-- =========================================================
-- 0013 · Auditoria automática de decisões (registros_presenca / justificativas)
-- =========================================================

create or replace function tlp_presenca.registrar_auditoria_registro_presenca()
returns trigger
language plpgsql
security definer
set search_path = tlp_presenca
as $$
begin
  if new.status is distinct from old.status then
    insert into tlp_presenca.audit_log (ator_id, acao, entidade, entidade_id, detalhes)
    values (
      auth.uid(),
      'registro_presenca_status_alterado',
      'registros_presenca',
      new.id,
      jsonb_build_object('de', old.status, 'para', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger trg_audit_registros_presenca
  after update of status on tlp_presenca.registros_presenca
  for each row execute function tlp_presenca.registrar_auditoria_registro_presenca();

create or replace function tlp_presenca.registrar_auditoria_justificativa()
returns trigger
language plpgsql
security definer
set search_path = tlp_presenca
as $$
begin
  if new.status is distinct from old.status then
    insert into tlp_presenca.audit_log (ator_id, acao, entidade, entidade_id, detalhes)
    values (
      auth.uid(),
      'justificativa_status_alterado',
      'justificativas',
      new.id,
      jsonb_build_object('de', old.status, 'para', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger trg_audit_justificativas
  after update of status on tlp_presenca.justificativas
  for each row execute function tlp_presenca.registrar_auditoria_justificativa();

-- Auditoria de mudanças de papel/hierarquia (perfis, gestor_filiais) — sensível,
-- então é registrada mesmo quando feita pelo painel de gestão de usuários.
create or replace function tlp_presenca.registrar_auditoria_perfil()
returns trigger
language plpgsql
security definer
set search_path = tlp_presenca
as $$
begin
  if new.perfil is distinct from old.perfil or new.filial_id is distinct from old.filial_id then
    insert into tlp_presenca.audit_log (ator_id, acao, entidade, entidade_id, detalhes)
    values (
      auth.uid(),
      'perfil_usuario_alterado',
      'perfis',
      new.id,
      jsonb_build_object(
        'perfil_de', old.perfil, 'perfil_para', new.perfil,
        'filial_de', old.filial_id, 'filial_para', new.filial_id
      )
    );
  end if;
  return new;
end;
$$;

create trigger trg_audit_perfis
  after update of perfil, filial_id on tlp_presenca.perfis
  for each row execute function tlp_presenca.registrar_auditoria_perfil();

create or replace function tlp_presenca.registrar_auditoria_gestor_filial()
returns trigger
language plpgsql
security definer
set search_path = tlp_presenca
as $$
begin
  insert into tlp_presenca.audit_log (ator_id, acao, entidade, entidade_id, detalhes)
  values (
    auth.uid(),
    case when tg_op = 'INSERT' then 'gestor_atribuido_filial' else 'gestor_removido_filial' end,
    'gestor_filiais',
    coalesce(new.gestor_id, old.gestor_id),
    jsonb_build_object('gestor_id', coalesce(new.gestor_id, old.gestor_id), 'filial_id', coalesce(new.filial_id, old.filial_id))
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_audit_gestor_filiais
  after insert or delete on tlp_presenca.gestor_filiais
  for each row execute function tlp_presenca.registrar_auditoria_gestor_filial();
