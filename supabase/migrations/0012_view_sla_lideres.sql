-- =========================================================
-- 0012 · View de SLA e ranking de líderes
--
-- Unifica decisões de registros_presenca e justificativas por gestor,
-- calculando tempo médio de resposta e % dentro da meta de SLA (2h).
-- =========================================================

create or replace view tlp_presenca.vw_sla_lideres as
with decisoes as (
  select
    analisado_por as gestor_id,
    created_at as criado_em,
    analisado_em,
    status::text
  from tlp_presenca.registros_presenca
  where analisado_por is not null and analisado_em is not null

  union all

  select
    analisado_por as gestor_id,
    created_at as criado_em,
    analisado_em,
    status::text
  from tlp_presenca.justificativas
  where analisado_por is not null and analisado_em is not null
),
agregado as (
  select
    gestor_id,
    count(*) as total_decisoes,
    count(*) filter (where status in ('justificado', 'aprovada')) as total_aprovadas,
    count(*) filter (where status in ('ausente', 'rejeitada')) as total_rejeitadas,
    round(avg(extract(epoch from (analisado_em - criado_em)) / 60)::numeric, 1) as tempo_medio_min,
    round(
      100.0 * count(*) filter (where analisado_em - criado_em <= interval '120 minutes')
      / nullif(count(*), 0),
      1
    ) as pct_dentro_sla
  from decisoes
  group by gestor_id
)
select
  p.id as gestor_id,
  p.nome as gestor_nome,
  p.filial_id as filial_home_id,
  f.nome as filial_home_nome,
  coalesce(a.total_decisoes, 0) as total_decisoes,
  coalesce(a.total_aprovadas, 0) as total_aprovadas,
  coalesce(a.total_rejeitadas, 0) as total_rejeitadas,
  a.tempo_medio_min,
  a.pct_dentro_sla,
  (
    select count(*) from tlp_presenca.registros_presenca rp
    join tlp_presenca.gestor_filiais gf on gf.filial_id = rp.filial_id
    where gf.gestor_id = p.id and rp.status = 'pendente_aprovacao'
  ) as pendencias_atuais
from tlp_presenca.perfis p
left join tlp_presenca.filiais f on f.id = p.filial_id
left join agregado a on a.gestor_id = p.id
where p.perfil = 'gestor';

comment on view tlp_presenca.vw_sla_lideres is
  'Ranking de líderes por volume de decisões, tempo médio de resposta e % dentro do SLA de 2h. Usada no dashboard do coordenador.';

-- Views herdam RLS das tabelas base; ainda assim, restringe explicitamente
-- quem pode consultar a view a quem tem visão global.
alter view tlp_presenca.vw_sla_lideres set (security_invoker = true);
