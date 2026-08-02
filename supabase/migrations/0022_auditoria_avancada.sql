-- =========================================================
-- 0022 · Módulo 11 — Auditoria avançada
--
-- Amplia a trilha de auditoria (0013) para cobrir o que ainda faltava:
--   - envio/aprovação/rejeição/alteração manual de status → status_dia
--   - edição de dados do usuário (nome/email) → perfis
--   - login/logout e solicitação de redefinição de senha → eventos sem
--     tabela própria, registrados diretamente pelo client (authService),
--     por isso precisam de uma policy de insert dedicada.
-- =========================================================

-- ---------------------------------------------------------
-- status_dia: cobre envio da presença (FALTA/FOLGA->PENDENTE), aprovação
-- (->PRESENTE), rejeição (->FALTA/FOLGA) e marcação manual (->qualquer
-- status), já que todas essas ações passam por uma mudança de `status`.
-- ---------------------------------------------------------
create or replace function tlp_presenca.registrar_auditoria_status_dia()
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
      'status_dia_alterado',
      'status_dia',
      new.id,
      jsonb_build_object(
        'colaborador_id', new.colaborador_id,
        'de', old.status,
        'para', new.status,
        'motivo_outros', new.motivo_outros,
        'observacao', new.observacao
      )
    );
  end if;
  return new;
end;
$$;

create trigger trg_audit_status_dia
  after update of status on tlp_presenca.status_dia
  for each row execute function tlp_presenca.registrar_auditoria_status_dia();

-- ---------------------------------------------------------
-- perfis: edição de dados cadastrais (nome/email), separado da auditoria
-- de papel/filial já existente (0013) para não confundir "trocou de cargo"
-- com "corrigiu o e-mail".
-- ---------------------------------------------------------
create or replace function tlp_presenca.registrar_auditoria_perfil_dados()
returns trigger
language plpgsql
security definer
set search_path = tlp_presenca
as $$
begin
  if new.nome is distinct from old.nome or new.email is distinct from old.email then
    insert into tlp_presenca.audit_log (ator_id, acao, entidade, entidade_id, detalhes)
    values (
      auth.uid(),
      'perfil_dados_alterados',
      'perfis',
      new.id,
      jsonb_build_object('nome_de', old.nome, 'nome_para', new.nome, 'email_de', old.email, 'email_para', new.email)
    );
  end if;
  return new;
end;
$$;

create trigger trg_audit_perfis_dados
  after update of nome, email on tlp_presenca.perfis
  for each row execute function tlp_presenca.registrar_auditoria_perfil_dados();

-- ---------------------------------------------------------
-- Eventos sem tabela própria (login, logout, solicitação de redefinição de
-- senha): registrados via insert direto do client autenticado. A policy
-- restringe a ação (whitelist) e exige que o usuário só audite a si mesmo.
-- ---------------------------------------------------------
create policy "audit_log_insert_eventos_proprios"
  on tlp_presenca.audit_log for insert
  to authenticated
  with check (
    ator_id = auth.uid()
    and acao in ('login', 'logout', 'senha_redefinida_solicitada')
  );

-- "Redefinir senha" administrativo (por um admin, para outro usuário) usa a
-- mesma ação, mas com ator = o admin e entidade_id = o usuário alvo — cabe
-- na policy de admin já existente (audit_log_insert_admin, 0005), então não
-- precisa de policy adicional.
