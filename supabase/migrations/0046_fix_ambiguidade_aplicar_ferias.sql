-- =========================================================
-- 0046 · Corrige ambiguidade de coluna em aplicar_ferias
--
-- RETURNS TABLE(data_referencia date, ...) cria uma variável implícita
-- "data_referencia" com escopo na função inteira — colidindo com a coluna
-- status_dia.data_referencia usada sem alias na 2ª passada da função,
-- estourando "column reference \"data_referencia\" is ambiguous" (42702)
-- em toda chamada real (líder/coordenador logado, não só via anon/teste).
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

  -- 1ª passada: garante que a linha de cada dia existe e detecta conflitos,
  -- sem alterar nenhum status ainda.
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

  -- 2ª passada: aplica de fato (sem conflito, ou sobrescrevendo com aval).
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

  -- Alerta assíncrono pro coordenador do líder do colaborador, só quando
  -- algo foi de fato sobrescrito (não incomoda em toda aplicação de férias).
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

comment on function tlp_presenca.aplicar_ferias(uuid, date, date, text, boolean) is
  'Aplica status OUTROS/Férias em todos os dias do intervalo. Sem p_sobrescrever, para na primeira passada se houver conflito (registro real ou status manual já existente) e devolve o preview sem aplicar nada — o front decide se relança com p_sobrescrever=true.';
