-- =========================================================
-- 0058 · Corrige aprovar_saida_atendimento — não dava pra aprovar nem
-- rejeitar nenhuma saída de atendimento
--
-- Bug real: o UPDATE fazia
--   set status_aprovacao = case when p_aprovar then 'aprovado' else 'rejeitado' end
-- Sem cast explícito, o CASE resolve como `text`, e a coluna é do tipo enum
-- status_aprovacao_atendimento — Postgres não faz esse cast implícito, então
-- TODA chamada da função (aprovar ou rejeitar) sempre falhava com
-- "column status_aprovacao is of type status_aprovacao_atendimento but
-- expression is of type text". O frontend engolia o erro sem mostrar nada
-- (só via feedback: os botões pareciam não fazer nada).
-- =========================================================

create or replace function tlp_presenca.aprovar_saida_atendimento(p_marcacao_id uuid, p_aprovar boolean)
returns tlp_presenca.marcacoes_atendimento
language plpgsql
security definer
set search_path = tlp_presenca
as $$
declare
  v_marcacao tlp_presenca.marcacoes_atendimento;
  v_ator uuid := auth.uid();
begin
  select * into v_marcacao from tlp_presenca.marcacoes_atendimento where id = p_marcacao_id for update;
  if not found then
    raise exception 'Marcação de atendimento % não encontrada', p_marcacao_id;
  end if;

  if not (
    tlp_presenca.sou_admin()
    or tlp_presenca.sou_gerente()
    or tlp_presenca.sou_lider_do_colaborador(v_marcacao.colaborador_id)
    or (tlp_presenca.sou_coordenador() and tlp_presenca.sou_coordenador_do_colaborador(v_marcacao.colaborador_id))
  ) then
    raise exception 'Sem permissão para decidir esta saída de atendimento';
  end if;

  update tlp_presenca.marcacoes_atendimento
  set status_aprovacao = (case when p_aprovar then 'aprovado' else 'rejeitado' end)::tlp_presenca.status_aprovacao_atendimento,
      aprovado_por = v_ator,
      aprovado_em = now()
  where id = p_marcacao_id
  returning * into v_marcacao;

  insert into tlp_presenca.audit_log (ator_id, acao, entidade, entidade_id, detalhes)
  values (
    v_ator,
    case when p_aprovar then 'atendimento_saida_aprovada' else 'atendimento_saida_rejeitada' end,
    'marcacoes_atendimento', p_marcacao_id,
    jsonb_build_object('colaborador_id', v_marcacao.colaborador_id)
  );

  return v_marcacao;
end;
$$;

comment on function tlp_presenca.aprovar_saida_atendimento(uuid, boolean) is
  'Aprova/rejeita a saída de um atendimento. Nunca mexe em status_dia — a presença do dia já foi decidida na aprovação da entrada.';
