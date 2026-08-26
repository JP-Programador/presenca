-- =========================================================
-- 0067 · Admin também recebe o resumo push (visão geral, todos os líderes)
--
-- resumo_nao_lancaram_por_coordenador() só cobre líderes vinculados a um
-- coordenador (perfis.coordenador_id) — admin não é coordenador de
-- ninguém, então precisa de uma versão sem esse agrupamento: uma linha só,
-- somando TODOS os líderes/colaboradores do sistema.
-- =========================================================

create or replace function tlp_presenca.resumo_nao_lancaram_geral()
returns table(lideres_pendentes integer, total_colaboradores integer, colaboradores_pendentes integer)
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select
    (select count(distinct lider_id)::integer from tlp_presenca.contar_nao_lancaram_por_lider()),
    (select count(*)::integer from tlp_presenca.colaboradores where ativo = true),
    (select coalesce(sum(total), 0)::integer from tlp_presenca.contar_nao_lancaram_por_lider());
$$;

comment on function tlp_presenca.resumo_nao_lancaram_geral() is
  'Mesmo resumo do coordenador (líderes com pendência + % da equipe), mas somando TODOS os líderes do sistema — usado no lembrete push do admin.';
