-- =========================================================
-- 0070 · Colaboradores com mais de 3 dias de falta — só auditoria
--
-- Lista pedida pela auditoria: quem acumulou mais de N dias de FALTA num
-- período recente, com todos os dados de contexto (colaborador, líder,
-- coordenador) numa linha só, sem precisar cruzar telas.
-- =========================================================

create or replace function tlp_presenca.colaboradores_faltas_recorrentes(
  p_dias integer default 30,
  p_minimo integer default 3
)
returns table(
  colaborador_id uuid,
  colaborador_nome text,
  colaborador_matricula text,
  filial_nome text,
  lider_id uuid,
  lider_nome text,
  coordenador_id uuid,
  coordenador_nome text,
  total_faltas integer,
  primeira_falta date,
  ultima_falta date
)
language plpgsql
stable
security definer
set search_path = tlp_presenca
as $$
begin
  if not (tlp_presenca.sou_auditor() or tlp_presenca.sou_admin()) then
    raise exception 'Só auditoria tem acesso a essa lista';
  end if;

  return query
    select
      c.id,
      c.nome,
      c.matricula,
      f.nome,
      c.lider_id,
      lider.nome,
      lider.coordenador_id,
      coord.nome,
      count(*)::integer as total_faltas,
      min(sd.data_referencia),
      max(sd.data_referencia)
    from tlp_presenca.status_dia sd
    join tlp_presenca.colaboradores c on c.id = sd.colaborador_id
    join tlp_presenca.filiais f on f.id = c.filial_id
    left join tlp_presenca.perfis lider on lider.id = c.lider_id
    left join tlp_presenca.perfis coord on coord.id = lider.coordenador_id
    where sd.status = 'FALTA'
      and sd.data_referencia >= (now() at time zone 'America/Sao_Paulo')::date - p_dias
      and c.ativo = true
    group by c.id, c.nome, c.matricula, f.nome, c.lider_id, lider.nome, lider.coordenador_id, coord.nome
    having count(*) > p_minimo
    order by count(*) desc;
end;
$$;

comment on function tlp_presenca.colaboradores_faltas_recorrentes(integer, integer) is
  'Colaboradores com mais de p_minimo dias de FALTA nos últimos p_dias dias, com dados de líder e coordenador — restrito a auditoria/admin.';
