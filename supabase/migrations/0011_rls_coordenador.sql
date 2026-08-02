-- =========================================================
-- 0011 · Políticas adicionais de RLS para o coordenador
--
-- São políticas ADICIONAIS (não substituem as da 0005) — no Postgres,
-- múltiplas policies permissivas para o mesmo comando são combinadas com OR,
-- então isso amplia o acesso sem tocar nas regras já existentes de gestor/admin.
-- =========================================================

-- ---------------------------------------------------------
-- Leitura global (dashboard do coordenador, mapa, ranking, auditoria)
-- ---------------------------------------------------------
create policy "registros_select_coordenador"
  on tlp_presenca.registros_presenca for select
  to authenticated
  using (tlp_presenca.visao_global());

create policy "justificativas_select_coordenador"
  on tlp_presenca.justificativas for select
  to authenticated
  using (tlp_presenca.visao_global());

create policy "colaboradores_select_coordenador"
  on tlp_presenca.colaboradores for select
  to authenticated
  using (tlp_presenca.visao_global());

create policy "audit_log_select_coordenador"
  on tlp_presenca.audit_log for select
  to authenticated
  using (tlp_presenca.visao_global());

-- ---------------------------------------------------------
-- Gestão de usuários e hierarquia (perfis, gestor_filiais)
-- ---------------------------------------------------------
create policy "perfis_select_coordenador"
  on tlp_presenca.perfis for select
  to authenticated
  using (tlp_presenca.visao_global());

create policy "perfis_update_coordenador"
  on tlp_presenca.perfis for update
  to authenticated
  using (tlp_presenca.pode_gerenciar_usuarios())
  with check (tlp_presenca.pode_gerenciar_usuarios());

create policy "perfis_insert_coordenador"
  on tlp_presenca.perfis for insert
  to authenticated
  with check (tlp_presenca.pode_gerenciar_usuarios());

create policy "gestor_filiais_all_coordenador"
  on tlp_presenca.gestor_filiais for all
  to authenticated
  using (tlp_presenca.pode_gerenciar_usuarios())
  with check (tlp_presenca.pode_gerenciar_usuarios());

-- ---------------------------------------------------------
-- Aprovação/rejeição também pelo coordenador (não só pelo gestor da filial)
-- ---------------------------------------------------------
create policy "registros_update_coordenador"
  on tlp_presenca.registros_presenca for update
  to authenticated
  using (tlp_presenca.visao_global())
  with check (tlp_presenca.visao_global());

create policy "justificativas_update_coordenador"
  on tlp_presenca.justificativas for update
  to authenticated
  using (tlp_presenca.visao_global())
  with check (tlp_presenca.visao_global());
