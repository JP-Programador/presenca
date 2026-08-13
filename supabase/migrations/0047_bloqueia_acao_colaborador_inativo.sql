-- =========================================================
-- 0047 · Bloqueia ações de status/férias em colaborador inativo
--
-- Bug real: colaborador demitido (ativo=false) teve "Cancelar férias"
-- aplicado depois da desativação (ninguém impedia), o que recalculou os
-- últimos dias como FALTA — e como as listagens de pendências não
-- filtravam por colaboradores.ativo, ele continuou aparecendo pra quem
-- tem visão daquele status_dia mesmo já desligado.
--
-- Esta migration fecha o lado do banco: nenhuma RPC de escrita em
-- status_dia (aplicar_ferias, cancelar_ferias, transicionar_status_dia)
-- aceita mais um colaborador_id de um colaborador inativo. O lado da
-- listagem (esconder inativo das telas) é resolvido no frontend.
-- =========================================================

create or replace function tlp_presenca.aplicar_ferias(
  p_colaborador_id uuid,
  p_data_inicio date,
  p_data_fim date,
  p_observacao text default null,
  p_sobrescrever boolean default false
)
returns table(data_referencia date, conflito boolean, aplicado boolean)
language plpgsql
security definer
set search_path = tlp_presenca
as $$
declare
  v_data date;
  v_row tlp_presenca.status_dia;
  v_tipo_dia tlp_presenca.tipo_dia;
  v_repouso tlp_presenca.status_dia_enum;
  v_conflito boolean;
  v_tem_conflito boolean := false;
  v_ator uuid := auth.uid();
  v_lider_id uuid;
  v_coordenador_id uuid;
  v_datas_conflito date[] := '{}';
begin
  if not exists (select 1 from tlp_presenca.colaboradores where id = p_colaborador_id and ativo) then
    raise exception 'Colaborador inativo — não é possível aplicar férias';
  end if;

  if p_data_fim < p_data_inicio then
    raise exception 'Data final não pode ser anterior à data inicial';
  end if;
  if p_data_fim - p_data_inicio > 60 then
    raise exception 'Período de férias não pode ultrapassar 60 dias';
  end if;

  if not (
    tlp_presenca.sou_admin()
    or tlp_presenca.sou_lider_do_colaborador(p_colaborador_id)
    or (tlp_presenca.sou_coordenador() and tlp_presenca.sou_coordenador_do_colaborador(p_colaborador_id))
  ) then
    raise exception 'Sem permissão para aplicar férias a este colaborador';
  end if;

  for v_data in select generate_series(p_data_inicio, p_data_fim, interval '1 day')::date loop
    v_row := tlp_presenca.obter_ou_criar_status_dia(p_colaborador_id, v_data);
    v_tipo_dia := tlp_presenca.tipo_dia_calendario(v_data);
    v_repouso := tlp_presenca.status_inicial_dia(v_tipo_dia);
    v_conflito := v_row.registro_presenca_id is not null or v_row.status <> v_repouso;
    if v_conflito then
      v_tem_conflito := true;
      v_datas_conflito := array_append(v_datas_conflito, v_data);
    end if;
  end loop;

  if v_tem_conflito and not p_sobrescrever then
    return query
      select gs::date, (gs::date = any(v_datas_conflito)), false
      from generate_series(p_data_inicio, p_data_fim, interval '1 day') gs;
    return;
  end if;

  for v_data in select generate_series(p_data_inicio, p_data_fim, interval '1 day')::date loop
    select * into v_row from tlp_presenca.status_dia sd
      where sd.colaborador_id = p_colaborador_id and sd.data_referencia = v_data;
    v_conflito := v_data = any(v_datas_conflito);

    if v_conflito then
      insert into tlp_presenca.audit_log (ator_id, acao, entidade, entidade_id, detalhes)
      values (
        v_ator, 'ferias_sobrescreveu_registro', 'status_dia', v_row.id,
        jsonb_build_object(
          'data_referencia', v_data,
          'status_anterior', v_row.status,
          'motivo_outros_anterior', v_row.motivo_outros,
          'tinha_checkin', v_row.registro_presenca_id is not null
        )
      );
    end if;

    perform tlp_presenca.transicionar_status_dia(
      v_row.id, 'OUTROS'::tlp_presenca.status_dia_enum, null,
      'Férias'::tlp_presenca.motivo_outros_enum, p_observacao, true
    );
  end loop;

  if v_tem_conflito then
    select c.lider_id into v_lider_id from tlp_presenca.colaboradores c where c.id = p_colaborador_id;
    if v_lider_id is not null then
      select coordenador_id into v_coordenador_id from tlp_presenca.perfis where id = v_lider_id;
      if v_coordenador_id is not null and v_coordenador_id <> v_ator then
        insert into tlp_presenca.alertas (tipo, colaborador_id, destinatario_id, detalhes)
        values (
          'ferias_sobrescreveu_registro',
          p_colaborador_id,
          v_coordenador_id,
          jsonb_build_object(
            'data_inicio', p_data_inicio,
            'data_fim', p_data_fim,
            'datas_conflito', to_jsonb(v_datas_conflito),
            'aplicado_por', v_ator
          )
        );
      end if;
    end if;
  end if;

  return query
    select gs::date, (gs::date = any(v_datas_conflito)), true
    from generate_series(p_data_inicio, p_data_fim, interval '1 day') gs;
end;
$$;

create or replace function tlp_presenca.cancelar_ferias(
  p_colaborador_id uuid,
  p_data_inicio date,
  p_data_fim date
)
returns void
language plpgsql
security definer
set search_path = tlp_presenca
as $$
declare
  v_data date;
  v_row tlp_presenca.status_dia;
begin
  if not exists (select 1 from tlp_presenca.colaboradores where id = p_colaborador_id and ativo) then
    raise exception 'Colaborador inativo — não é possível cancelar férias';
  end if;

  if not (
    tlp_presenca.sou_admin()
    or tlp_presenca.sou_lider_do_colaborador(p_colaborador_id)
    or (tlp_presenca.sou_coordenador() and tlp_presenca.sou_coordenador_do_colaborador(p_colaborador_id))
  ) then
    raise exception 'Sem permissão para cancelar férias deste colaborador';
  end if;

  for v_data in select generate_series(p_data_inicio, p_data_fim, interval '1 day')::date loop
    select * into v_row from tlp_presenca.status_dia
      where colaborador_id = p_colaborador_id and data_referencia = v_data;

    if found and v_row.status = 'OUTROS' and v_row.motivo_outros = 'Férias' then
      perform tlp_presenca.transicionar_status_dia(
        v_row.id, 'FALTA'::tlp_presenca.status_dia_enum, null, null, null, false
      );
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------
-- transicionar_status_dia — mesma trava, pro caminho mais genérico
-- (aprovar/rejeitar/marcar manual pelo StatusActionMenu).
-- ---------------------------------------------------------
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
begin
  select * into v_atual from tlp_presenca.status_dia where id = p_id for update;
  if not found then
    raise exception 'status_dia % não encontrado', p_id;
  end if;

  if not (
    tlp_presenca.sou_admin()
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

  return v_atual;
end;
$$;

comment on function tlp_presenca.transicionar_status_dia(uuid, tlp_presenca.status_dia_enum, uuid, tlp_presenca.motivo_outros_enum, text, boolean) is
  'Aplica uma transição validada de status_dia. p_forcar_status=true (marcação manual do líder) faz o status pedido valer como está, sem recalcular repouso pro par FALTA/FOLGA. Recusa qualquer alteração se o colaborador estiver inativo.';
