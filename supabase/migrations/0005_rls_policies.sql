-- =========================================================
-- 0005 · Row Level Security (RLS)
--
-- Modelo de acesso:
--   admin        -> tudo, todas as filiais
--   gestor       -> leitura/escrita restrita às filiais em gestor_filiais
--   colaborador  -> leitura/escrita restrita aos próprios registros
-- =========================================================

alter table tlp_presenca.filiais            enable row level security;
alter table tlp_presenca.perfis             enable row level security;
alter table tlp_presenca.gestor_filiais     enable row level security;
alter table tlp_presenca.colaboradores      enable row level security;
alter table tlp_presenca.escalas            enable row level security;
alter table tlp_presenca.registros_presenca enable row level security;
alter table tlp_presenca.justificativas     enable row level security;
alter table tlp_presenca.audit_log          enable row level security;

-- ---------------------------------------------------------
-- filiais
-- ---------------------------------------------------------
create policy "filiais_select_autenticados"
  on tlp_presenca.filiais for select
  to authenticated
  using (true); -- lista de filiais é referência básica, visível a todo usuário logado

create policy "filiais_insert_admin"
  on tlp_presenca.filiais for insert
  to authenticated
  with check (tlp_presenca.sou_admin());

create policy "filiais_update_admin"
  on tlp_presenca.filiais for update
  to authenticated
  using (tlp_presenca.sou_admin())
  with check (tlp_presenca.sou_admin());

create policy "filiais_delete_admin"
  on tlp_presenca.filiais for delete
  to authenticated
  using (tlp_presenca.sou_admin());

-- ---------------------------------------------------------
-- perfis
-- ---------------------------------------------------------
create policy "perfis_select_proprio_ou_admin"
  on tlp_presenca.perfis for select
  to authenticated
  using (id = auth.uid() or tlp_presenca.sou_admin());

create policy "perfis_update_proprio_ou_admin"
  on tlp_presenca.perfis for update
  to authenticated
  using (id = auth.uid() or tlp_presenca.sou_admin())
  with check (
    id = auth.uid() and perfil = (select perfil from tlp_presenca.perfis where id = auth.uid())
    or tlp_presenca.sou_admin()
  ); -- usuário comum pode editar o próprio nome, mas não o próprio "perfil" (role)

create policy "perfis_insert_admin"
  on tlp_presenca.perfis for insert
  to authenticated
  with check (tlp_presenca.sou_admin());

create policy "perfis_delete_admin"
  on tlp_presenca.perfis for delete
  to authenticated
  using (tlp_presenca.sou_admin());

-- ---------------------------------------------------------
-- gestor_filiais
-- ---------------------------------------------------------
create policy "gestor_filiais_select_proprio_ou_admin"
  on tlp_presenca.gestor_filiais for select
  to authenticated
  using (gestor_id = auth.uid() or tlp_presenca.sou_admin());

create policy "gestor_filiais_all_admin"
  on tlp_presenca.gestor_filiais for all
  to authenticated
  using (tlp_presenca.sou_admin())
  with check (tlp_presenca.sou_admin());

-- ---------------------------------------------------------
-- colaboradores
-- ---------------------------------------------------------
create policy "colaboradores_select"
  on tlp_presenca.colaboradores for select
  to authenticated
  using (
    tlp_presenca.sou_admin()
    or tlp_presenca.gerencio_filial(filial_id)
    or perfil_id = auth.uid()
  );

create policy "colaboradores_insert"
  on tlp_presenca.colaboradores for insert
  to authenticated
  with check (tlp_presenca.sou_admin() or tlp_presenca.gerencio_filial(filial_id));

create policy "colaboradores_update"
  on tlp_presenca.colaboradores for update
  to authenticated
  using (tlp_presenca.sou_admin() or tlp_presenca.gerencio_filial(filial_id))
  with check (tlp_presenca.sou_admin() or tlp_presenca.gerencio_filial(filial_id));

create policy "colaboradores_delete_admin"
  on tlp_presenca.colaboradores for delete
  to authenticated
  using (tlp_presenca.sou_admin());

-- ---------------------------------------------------------
-- escalas
-- ---------------------------------------------------------
create policy "escalas_select"
  on tlp_presenca.escalas for select
  to authenticated
  using (
    tlp_presenca.sou_admin()
    or exists (
      select 1 from tlp_presenca.colaboradores c
      where c.id = escalas.colaborador_id
        and (tlp_presenca.gerencio_filial(c.filial_id) or c.perfil_id = auth.uid())
    )
  );

create policy "escalas_insert_update_delete_gestor"
  on tlp_presenca.escalas for all
  to authenticated
  using (
    tlp_presenca.sou_admin()
    or exists (
      select 1 from tlp_presenca.colaboradores c
      where c.id = escalas.colaborador_id and tlp_presenca.gerencio_filial(c.filial_id)
    )
  )
  with check (
    tlp_presenca.sou_admin()
    or exists (
      select 1 from tlp_presenca.colaboradores c
      where c.id = escalas.colaborador_id and tlp_presenca.gerencio_filial(c.filial_id)
    )
  );

-- ---------------------------------------------------------
-- registros_presenca
-- ---------------------------------------------------------
create policy "registros_select"
  on tlp_presenca.registros_presenca for select
  to authenticated
  using (
    tlp_presenca.sou_admin()
    or tlp_presenca.gerencio_filial(filial_id)
    or colaborador_id = tlp_presenca.meu_colaborador_id()
  );

-- colaborador registra a própria presença; gestor/admin podem registrar por qualquer colaborador da filial
create policy "registros_insert"
  on tlp_presenca.registros_presenca for insert
  to authenticated
  with check (
    tlp_presenca.sou_admin()
    or tlp_presenca.gerencio_filial(filial_id)
    or colaborador_id = tlp_presenca.meu_colaborador_id()
  );

-- edição só para gestor/admin (ex.: corrigir status, anexar observação); colaborador não edita marcação já feita
create policy "registros_update_gestor"
  on tlp_presenca.registros_presenca for update
  to authenticated
  using (tlp_presenca.sou_admin() or tlp_presenca.gerencio_filial(filial_id))
  with check (tlp_presenca.sou_admin() or tlp_presenca.gerencio_filial(filial_id));

create policy "registros_delete_admin"
  on tlp_presenca.registros_presenca for delete
  to authenticated
  using (tlp_presenca.sou_admin());

-- ---------------------------------------------------------
-- justificativas
-- ---------------------------------------------------------
create policy "justificativas_select"
  on tlp_presenca.justificativas for select
  to authenticated
  using (
    tlp_presenca.sou_admin()
    or colaborador_id = tlp_presenca.meu_colaborador_id()
    or exists (
      select 1 from tlp_presenca.colaboradores c
      where c.id = justificativas.colaborador_id and tlp_presenca.gerencio_filial(c.filial_id)
    )
  );

-- colaborador cria sua própria justificativa
create policy "justificativas_insert_proprio"
  on tlp_presenca.justificativas for insert
  to authenticated
  with check (
    colaborador_id = tlp_presenca.meu_colaborador_id()
    or tlp_presenca.sou_admin()
    or exists (
      select 1 from tlp_presenca.colaboradores c
      where c.id = justificativas.colaborador_id and tlp_presenca.gerencio_filial(c.filial_id)
    )
  );

-- só gestor/admin aprova ou rejeita (update de status)
create policy "justificativas_update_gestor"
  on tlp_presenca.justificativas for update
  to authenticated
  using (
    tlp_presenca.sou_admin()
    or exists (
      select 1 from tlp_presenca.colaboradores c
      where c.id = justificativas.colaborador_id and tlp_presenca.gerencio_filial(c.filial_id)
    )
  )
  with check (
    tlp_presenca.sou_admin()
    or exists (
      select 1 from tlp_presenca.colaboradores c
      where c.id = justificativas.colaborador_id and tlp_presenca.gerencio_filial(c.filial_id)
    )
  );

create policy "justificativas_delete_admin"
  on tlp_presenca.justificativas for delete
  to authenticated
  using (tlp_presenca.sou_admin());

-- ---------------------------------------------------------
-- audit_log — somente leitura para admin; escrita apenas via service_role
-- (as Edge Functions usam a service key, que ignora RLS por padrão,
--  mas mantemos a política explícita por clareza/defesa em profundidade)
-- ---------------------------------------------------------
create policy "audit_log_select_admin"
  on tlp_presenca.audit_log for select
  to authenticated
  using (tlp_presenca.sou_admin());

create policy "audit_log_insert_admin"
  on tlp_presenca.audit_log for insert
  to authenticated
  with check (tlp_presenca.sou_admin());
