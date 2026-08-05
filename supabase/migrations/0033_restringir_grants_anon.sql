-- =========================================================
-- 0033 · Restringe GRANTs do papel anon em tlp_presenca
--
-- A 0027 concedeu ALL (incluindo INSERT/UPDATE/DELETE) também para "anon",
-- e configurou ALTER DEFAULT PRIVILEGES para que tabelas/funções futuras
-- nasçam com esse mesmo acesso amplo por padrão. Na prática o app nunca usa
-- o papel anon para tocar nas tabelas diretamente: todo fluxo público
-- (check-in, marcação, validação) passa pelas Edge Functions com
-- service_role, e o painel administrativo só opera após login (papel
-- authenticated). Deixar "anon" com ALL é uma exposição sem necessidade —
-- se uma tabela nova esquecer de configurar RLS corretamente, ela nasce
-- gravável por qualquer requisição não autenticada.
--
-- "authenticated" continua com ALL de propósito: cada tabela tem RLS
-- (migrations anteriores) que decide o que cada usuário logado pode ver/
-- alterar, e é esse o modelo de acesso adotado no projeto.
-- =========================================================

revoke all on all tables in schema tlp_presenca from anon;
revoke all on all sequences in schema tlp_presenca from anon;
revoke all on all functions in schema tlp_presenca from anon;

alter default privileges in schema tlp_presenca
  revoke all on tables from anon;
alter default privileges in schema tlp_presenca
  revoke all on sequences from anon;
alter default privileges in schema tlp_presenca
  revoke all on functions from anon;
