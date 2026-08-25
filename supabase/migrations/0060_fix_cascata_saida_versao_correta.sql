-- =========================================================
-- 0060 · Corrige a 0059: cascata escrita na assinatura errada da função
--
-- transicionar_status_dia tinha DUAS versões no banco: uma de 5 parâmetros
-- (criada na 0018, nunca usada pelo app — obsoleta desde a 0039 introduzir
-- p_forcar_status) e a real, de 6 parâmetros (evoluída até a 0049, com
-- entrou_pendente_em, braços de permissão sou_gerente/sou_coordenador e
-- trava de colaborador inativo). A 0059 fez "create or replace" na
-- assinatura de 5 parâmetros — ou seja, reescreveu a versão morta que
-- ninguém chama, e a cascata nunca rodava de verdade. O frontend
-- (statusDiaService.ts) sempre passa p_forcar_status, então sempre cai na
-- versão de 6.
--
-- Esta migration: apaga a versão de 5 parâmetros (nunca deveria ter
-- continuado existindo) e reaplica a cascata em cima da versão de 6,
-- reproduzindo fielmente a lógica da 0049 (nada mudou nela além da
-- cascata no final).
-- =========================================================

drop function if exists tlp_presenca.transicionar_status_dia(
  uuid, tlp_presenca.status_dia_enum, uuid, tlp_presenca.motivo_outros_enum, text
);

create or replace function tlp_presenca.transicionar_status_dia(
  p_id uuid,
  p_novo_status tlp_presenca.status_dia_enum,
  p_registro_presenca_id uuid default null,
  p_motivo_outros tlp_presenca.motivo_outros_enum default null,
  p_observacao text default null,
  p_forcar_status boolean default false
)
returns tlp_presenca.status_dia
language plpgsql
security definer
set search_path = tlp_presenca
as $$
declare
  v_atual tlp_presenca.status_dia;
  v_tipo_dia_atual tlp_presenca.tipo_dia;
  v_estado_repouso tlp_presenca.status_dia_enum;
  v_ator uuid := auth.uid();
  v_saida_cancelada_id uuid;
begin
  select * into v_atual from tlp_presenca.status_dia where id = p_id for update;
  if not found then
    raise exception 'status_dia % não encontrado', p_id;
  end if;

  if not (
    tlp_presenca.sou_admin()
    or tlp_presenca.sou_gerente()
    or tlp_presenca.sou_lider_do_colaborador(v_atual.colaborador_id)
    or (tlp_presenca.sou_coordenador() and tlp_presenca.sou_coordenador_do_colaborador(v_atual.colaborador_id))
    or (v_atual.colaborador_id = tlp_presenca.meu_colaborador_id() and p_novo_status = 'PENDENTE')
  ) then
    raise exception 'Sem permissão para alterar este status_dia';
  end if;

  if not exists (select 1 from tlp_presenca.colaboradores where id = v_atual.colaborador_id and ativo) then
    raise exception 'Colaborador inativo — não é possível alterar o status do dia';
  end if;

  v_tipo_dia_atual := tlp_presenca.tipo_dia_calendario(v_atual.data_referencia);
  v_estado_repouso := tlp_presenca.status_inicial_dia(v_tipo_dia_atual);

  if p_novo_status = 'PENDENTE' then
    if v_atual.status not in ('FALTA', 'FOLGA') then
      raise exception 'Só é possível enviar para PENDENTE a partir de FALTA/FOLGA (atual: %)', v_atual.status;
    end if;
  elsif p_novo_status = 'PRESENTE' then
    null;
  elsif p_novo_status in ('FALTA', 'FOLGA') then
    null;
  elsif p_novo_status in ('ATESTADO', 'OUTROS') then
    if p_novo_status = 'OUTROS' and p_motivo_outros is null then
      raise exception 'motivo_outros é obrigatório para status OUTROS';
    end if;
  end if;

  update tlp_presenca.status_dia
  set status = case
      when p_novo_status in ('FALTA', 'FOLGA') and not p_forcar_status then v_estado_repouso
      else p_novo_status
    end,
      tipo_dia = v_tipo_dia_atual,
      registro_presenca_id = coalesce(p_registro_presenca_id, registro_presenca_id),
      motivo_outros = case when p_novo_status = 'OUTROS' then p_motivo_outros else null end,
      observacao = coalesce(p_observacao, observacao),
      entrou_pendente_em = case when p_novo_status = 'PENDENTE' then now() else entrou_pendente_em end,
      decidido_por = case when p_novo_status <> 'PENDENTE' then v_ator else decidido_por end,
      decidido_em = case when p_novo_status <> 'PENDENTE' then now() else decidido_em end
  where id = p_id
  returning * into v_atual;

  -- Saiu de PRESENTE (ou nunca chegou lá) — qualquer saída de atendimento
  -- pendente daquela entrada perdeu o sentido, cancela sozinha.
  if p_novo_status <> 'PRESENTE' and p_novo_status <> 'PENDENTE' and v_atual.registro_presenca_id is not null then
    update tlp_presenca.marcacoes_atendimento
    set status_aprovacao = 'rejeitado'::tlp_presenca.status_aprovacao_atendimento,
        aprovado_por = v_ator,
        aprovado_em = now()
    where registro_presenca_entrada_id = v_atual.registro_presenca_id
      and status_aprovacao = 'pendente'
    returning id into v_saida_cancelada_id;

    if v_saida_cancelada_id is not null then
      insert into tlp_presenca.audit_log (ator_id, acao, entidade, entidade_id, detalhes)
      values (
        v_ator, 'atendimento_saida_cancelada_por_status_dia', 'marcacoes_atendimento', v_saida_cancelada_id,
        jsonb_build_object('colaborador_id', v_atual.colaborador_id, 'novo_status_dia', p_novo_status)
      );
    end if;
  end if;

  return v_atual;
end;
$$;

comment on function tlp_presenca.transicionar_status_dia(uuid, tlp_presenca.status_dia_enum, uuid, tlp_presenca.motivo_outros_enum, text, boolean) is
  'Aplica uma transição validada de status_dia. Se o novo status não é PRESENTE/PENDENTE, cancela (rejeita) qualquer saída de atendimento ainda pendente da entrada vinculada — não faz sentido cobrar fechamento de um atendimento cuja presença foi desfeita/recusada.';
