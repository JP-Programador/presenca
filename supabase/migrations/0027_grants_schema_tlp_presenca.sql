-- =========================================================
-- 0027 · Permissões de schema para tlp_presenca
--
-- Schemas novos no Postgres NÃO herdam automaticamente as permissões que o
-- Supabase concede por padrão ao schema "public" — os papéis anon/
-- authenticated/service_role (usados pelo PostgREST/Edge Functions) não
-- tinham USAGE em "tlp_presenca", causando "permission denied for schema
-- tlp_presenca" em qualquer chamada, mesmo com service_role.
--
-- Seguro conceder amplamente aqui porque TODA tabela já tem RLS habilitada
-- (migrations anteriores) — GRANT dá o acesso "de fábrica" que o PostgREST
-- precisa pra sequer tentar a query; a RLS continua sendo quem decide quais
-- linhas cada papel realmente enxerga/altera.
-- =========================================================

grant usage on schema tlp_presenca to anon, authenticated, service_role;

grant all on all tables in schema tlp_presenca to anon, authenticated, service_role;
grant all on all sequences in schema tlp_presenca to anon, authenticated, service_role;
grant all on all functions in schema tlp_presenca to anon, authenticated, service_role;

-- Garante que tabelas/funções criadas no futuro (novas migrations) já
-- nasçam com essa permissão, sem precisar lembrar de repetir o GRANT.
alter default privileges in schema tlp_presenca
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema tlp_presenca
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema tlp_presenca
  grant all on functions to anon, authenticated, service_role;
