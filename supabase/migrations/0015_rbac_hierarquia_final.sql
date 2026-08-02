-- =========================================================
-- 0015 · Helpers de RBAC — nova hierarquia (admin / auditor / coordenador)
--
-- CREATE OR REPLACE FUNCTION não exige tocar nas policies que já chamam
-- essas funções por nome: o comportamento delas muda automaticamente.
-- Só as duas policies que precisavam de uma regra NOVA e mais estrita
-- (aprovação de presença pelo coordenador, sem incluir o auditor) são
-- recriadas ao final desta migration.
-- =========================================================

create or replace function tlp_presenca.sou_auditor()
returns boolean
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select exists (
    select 1 from tlp_presenca.perfis where id = auth.uid() and perfil = 'auditor'
  );
$$;

-- Leitura global (mapa, ranking, auditoria, usuários): admin, auditor e
-- coordenador enxergam tudo, de todas as filiais.
create or replace function tlp_presenca.visao_global()
returns boolean
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select tlp_presenca.sou_admin() or tlp_presenca.sou_auditor() or tlp_presenca.sou_coordenador();
$$;

-- Gestão de usuários e hierarquia (perfis, gestor_filiais): agora é
-- EXCLUSIVA do admin — coordenador deixou de poder criar/editar usuários
-- ou reatribuir gestores a filiais.
create or replace function tlp_presenca.pode_gerenciar_usuarios()
returns boolean
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select tlp_presenca.sou_admin();
$$;

-- Nova função: aprovação/rejeição de presença e justificativa em qualquer
-- filial. Inclui admin e coordenador, mas propositalmente NÃO inclui o
-- auditor (que só lê).
create or replace function tlp_presenca.pode_decidir_presenca()
returns boolean
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select tlp_presenca.sou_admin() or tlp_presenca.sou_coordenador();
$$;

-- ---------------------------------------------------------
-- As policies abaixo foram criadas na migration 0011 usando visao_global(),
-- que agora também é true para o auditor. Como aprovar/rejeitar é ação de
-- ESCRITA, essas duas precisam ser recriadas usando pode_decidir_presenca()
-- em vez de visao_global() — senão o auditor passaria a poder aprovar
-- presença, contrariando "auditor só lê".
-- ---------------------------------------------------------

drop policy if exists "registros_update_coordenador" on tlp_presenca.registros_presenca;
create policy "registros_update_coordenador"
  on tlp_presenca.registros_presenca for update
  to authenticated
  using (tlp_presenca.pode_decidir_presenca())
  with check (tlp_presenca.pode_decidir_presenca());

drop policy if exists "justificativas_update_coordenador" on tlp_presenca.justificativas;
create policy "justificativas_update_coordenador"
  on tlp_presenca.justificativas for update
  to authenticated
  using (tlp_presenca.pode_decidir_presenca())
  with check (tlp_presenca.pode_decidir_presenca());

-- As policies "perfis_update_coordenador", "perfis_insert_coordenador" e
-- "gestor_filiais_all_coordenador" (migration 0011) continuam chamando
-- pode_gerenciar_usuarios() — como essa função agora só retorna true para
-- admin, elas passam a valer só para admin automaticamente, sem precisar
-- ser recriadas.
