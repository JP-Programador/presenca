-- =========================================================
-- 0062 · Nome de colaboradores e usuários (líderes etc.) sempre em maiúsculo
--
-- Trigger no banco (não só no frontend) — garante que TODO caminho de
-- entrada (cadastro manual, importação em lote, edição, e qualquer coisa
-- futura) sempre grava o nome em maiúsculo, sem depender de cada tela
-- lembrar de fazer isso. Backfill dos nomes já cadastrados também.
-- =========================================================

create or replace function tlp_presenca.nome_maiusculo()
returns trigger
language plpgsql
as $$
begin
  new.nome := upper(new.nome);
  return new;
end;
$$;

create trigger colaboradores_nome_maiusculo
  before insert or update of nome on tlp_presenca.colaboradores
  for each row execute function tlp_presenca.nome_maiusculo();

create trigger perfis_nome_maiusculo
  before insert or update of nome on tlp_presenca.perfis
  for each row execute function tlp_presenca.nome_maiusculo();

update tlp_presenca.colaboradores set nome = upper(nome) where nome <> upper(nome);
update tlp_presenca.perfis set nome = upper(nome) where nome <> upper(nome);
