-- =========================================================
-- 0010 · Helpers de RBAC para o papel de coordenador
-- =========================================================

-- true se o usuário atual é coordenador (leitura ampla, gestão de usuários)
create or replace function tlp_presenca.sou_coordenador()
returns boolean
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select exists (
    select 1 from tlp_presenca.perfis where id = auth.uid() and perfil = 'coordenador'
  );
$$;

-- true se o usuário atual pode ver dados de todas as filiais (admin ou coordenador)
create or replace function tlp_presenca.visao_global()
returns boolean
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select tlp_presenca.sou_admin() or tlp_presenca.sou_coordenador();
$$;

-- true se o usuário atual pode gerenciar usuários/hierarquia (admin ou coordenador)
create or replace function tlp_presenca.pode_gerenciar_usuarios()
returns boolean
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select tlp_presenca.sou_admin() or tlp_presenca.sou_coordenador();
$$;
