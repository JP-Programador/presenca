-- =========================================================
-- 0059 · Cancela saída de atendimento pendente quando o status do dia
-- deixa de ser PRESENTE
--
-- Até aqui, status_dia e marcacoes_atendimento eram 100% independentes
-- (de propósito — ver 0055). Mas isso deixava um estado esquisito
-- possível: o líder marca o colaborador como FALTA/ATESTADO/OUTROS (ou
-- rejeita a entrada), e uma saída de atendimento daquela entrada continua
-- pendente pra sempre, sem fazer mais sentido nenhum.
--
-- Regra nova: toda vez que transicionar_status_dia muda o status pra algo
-- diferente de PRESENTE/PENDENTE (ou seja, FALTA/FOLGA/ATESTADO/OUTROS —
-- repouso ou marcação manual), qualquer saída de atendimento ainda
-- 'pendente' vinculada à entrada daquele status_dia é automaticamente
-- rejeitada. Continua sem tocar em status_dia no sentido contrário — só
-- essa direção (status_dia manda cancelar a saída, nunca o oposto).
-- =========================================================

create or replace function tlp_presenca.transicionar_status_dia(
  p_id uuid,
  p_novo_status tlp_presenca.status_dia_enum,
  p_registro_presenca_id uuid default null,
  p_motivo_outros tlp_presenca.motivo_outros_enum default null,
  p_observacao text default null
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
    or tlp_presenca.gerencio_filial(v_atual.filial_id)
    or tlp_presenca.pode_decidir_presenca()
    or (v_atual.colaborador_id = tlp_presenca.meu_colaborador_id() and p_novo_status = 'PENDENTE')
  ) then
    raise exception 'Sem permissão para alterar este status_dia';
  end if;

  v_tipo_dia_atual := tlp_presenca.tipo_dia_calendario(v_atual.data_referencia);
  v_estado_repouso := tlp_presenca.status_inicial_dia(v_tipo_dia_atual);

  if p_novo_status = 'PENDENTE' then
    if v_atual.status not in ('FALTA', 'FOLGA') then
      raise exception 'Só é possível enviar para PENDENTE a partir de FALTA/FOLGA (atual: %)', v_atual.status;
    end if;
  elsif p_novo_status = 'PRESENTE' then
    if v_atual.status not in ('PENDENTE', 'FALTA', 'FOLGA') then
      raise exception 'Transição para PRESENTE inválida a partir de %', v_atual.status;
    end if;
  elsif p_novo_status in ('FALTA', 'FOLGA') then
    null;
  elsif p_novo_status in ('ATESTADO', 'OUTROS') then
    if p_novo_status = 'OUTROS' and p_motivo_outros is null then
      raise exception 'motivo_outros é obrigatório para status OUTROS';
    end if;
  end if;

  update tlp_presenca.status_dia
  set status = case when p_novo_status in ('FALTA', 'FOLGA') then v_estado_repouso else p_novo_status end,
      tipo_dia = v_tipo_dia_atual,
      registro_presenca_id = coalesce(p_registro_presenca_id, registro_presenca_id),
      motivo_outros = case when p_novo_status = 'OUTROS' then p_motivo_outros else null end,
      observacao = coalesce(p_observacao, observacao),
      decidido_por = case when p_novo_status <> 'PENDENTE' then v_ator else decidido_por end,
      decidido_em = case when p_novo_status <> 'PENDENTE' then now() else decidido_em end
  where id = p_id
  returning * into v_atual;

  -- Saiu de PRESENTE (ou nunca chegou lá, no caso de rejeição direto de
  -- PENDENTE) — qualquer saída de atendimento pendente daquela entrada
  -- perdeu o sentido, cancela sozinha.
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

comment on function tlp_presenca.transicionar_status_dia(uuid, tlp_presenca.status_dia_enum, uuid, tlp_presenca.motivo_outros_enum, text) is
  'Aplica uma transição validada de status_dia. Se o novo status não é PRESENTE/PENDENTE, cancela (rejeita) qualquer saída de atendimento ainda pendente da entrada vinculada — não faz sentido cobrar fechamento de um atendimento cuja presença foi desfeita/recusada.';
