-- =========================================================
-- 0004 · Funções e triggers
-- =========================================================

-- ---------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------
create or replace function tlp_presenca.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_filiais_updated_at
  before update on tlp_presenca.filiais
  for each row execute function tlp_presenca.set_updated_at();

create trigger trg_perfis_updated_at
  before update on tlp_presenca.perfis
  for each row execute function tlp_presenca.set_updated_at();

create trigger trg_colaboradores_updated_at
  before update on tlp_presenca.colaboradores
  for each row execute function tlp_presenca.set_updated_at();

-- ---------------------------------------------------------
-- Cria automaticamente uma linha em tlp_presenca.perfis quando um usuário
-- é criado em auth.users (necessário rodar com security definer).
-- ---------------------------------------------------------
create or replace function tlp_presenca.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = tlp_presenca
as $$
begin
  insert into tlp_presenca.perfis (id, nome, email, perfil)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', new.email),
    new.email,
    'colaborador'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function tlp_presenca.handle_new_user();

-- ---------------------------------------------------------
-- Ao inserir um registro de presença com foto, define automaticamente
-- foto_expira_em = horario_registrado + 48h (usado pela Edge Function de limpeza).
-- ---------------------------------------------------------
create or replace function tlp_presenca.set_foto_expira_em()
returns trigger
language plpgsql
as $$
begin
  if new.foto_path is not null then
    new.foto_expira_em := new.horario_registrado + interval '48 hours';
  end if;
  return new;
end;
$$;

create trigger trg_registros_presenca_foto_expira
  before insert or update of foto_path on tlp_presenca.registros_presenca
  for each row execute function tlp_presenca.set_foto_expira_em();

-- ---------------------------------------------------------
-- Helpers de RBAC usados pelas políticas de RLS (0005) e pela storage (0006)
-- ---------------------------------------------------------

-- Retorna o perfil (role) do usuário autenticado atual
create or replace function tlp_presenca.meu_perfil()
returns tlp_presenca.perfil_acesso
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select perfil from tlp_presenca.perfis where id = auth.uid();
$$;

-- true se o usuário atual é admin
create or replace function tlp_presenca.sou_admin()
returns boolean
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select exists (
    select 1 from tlp_presenca.perfis where id = auth.uid() and perfil = 'admin'
  );
$$;

-- true se o usuário atual é gestor responsável pela filial informada (ou admin)
create or replace function tlp_presenca.gerencio_filial(p_filial_id uuid)
returns boolean
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select
    tlp_presenca.sou_admin()
    or exists (
      select 1 from tlp_presenca.gestor_filiais gf
      where gf.gestor_id = auth.uid() and gf.filial_id = p_filial_id
    );
$$;

-- retorna o colaborador_id vinculado ao usuário autenticado, se houver
create or replace function tlp_presenca.meu_colaborador_id()
returns uuid
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select id from tlp_presenca.colaboradores where perfil_id = auth.uid();
$$;
