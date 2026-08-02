-- =========================================================
-- 0023 · Módulo 12 — Exportações (view de suporte)
--
-- Uma linha por status_dia, já com todas as colunas pedidas pelos
-- relatórios (matrícula, nome, líder, filial, status final, hora de
-- envio/aprovação, aprovado por, motivo, observação, latitude/longitude).
-- Serve como base para presença diária/mensal/por líder/por filial/por
-- coordenador e pendências — todas são apenas filtros diferentes sobre a
-- mesma view (Módulo 12 não precisa de mais nada no banco).
-- =========================================================

create or replace view tlp_presenca.vw_relatorio_presenca as
select
  sd.id as status_dia_id,
  sd.data_referencia,
  c.matricula as colaborador_matricula,
  c.nome as colaborador_nome,
  f.id as filial_id,
  f.nome as filial_nome,
  (
    select string_agg(p2.nome, ', ' order by p2.nome)
    from tlp_presenca.gestor_filiais gf
    join tlp_presenca.perfis p2 on p2.id = gf.gestor_id
    where gf.filial_id = sd.filial_id
  ) as lider_nome,
  sd.status as status_final,
  rp.horario_registrado as hora_envio,
  sd.decidido_em as hora_aprovacao,
  pdec.nome as aprovado_por,
  sd.motivo_outros::text as motivo,
  sd.observacao,
  rp.latitude,
  rp.longitude
from tlp_presenca.status_dia sd
join tlp_presenca.colaboradores c on c.id = sd.colaborador_id
join tlp_presenca.filiais f on f.id = sd.filial_id
left join tlp_presenca.registros_presenca rp on rp.id = sd.registro_presenca_id
left join tlp_presenca.perfis pdec on pdec.id = sd.decidido_por;

comment on view tlp_presenca.vw_relatorio_presenca is
  'Uma linha por status_dia com todas as colunas dos relatórios do Módulo 12 (presença diária/mensal/por líder/filial/coordenador, pendências). Herda a RLS de status_dia via security_invoker.';

alter view tlp_presenca.vw_relatorio_presenca set (security_invoker = true);
