-- =========================================================
-- 0045 · Férias em lote (intervalo de datas)
--
-- Reaproveita o modelo existente: status OUTROS + motivo 'Férias' já
-- existiam (0018), o que faltava era um jeito de aplicar isso num
-- intervalo de datas de uma vez, sem o líder precisar marcar dia a dia.
--
-- aplicar_ferias: aplica 'OUTROS'/'Férias' em cada dia do intervalo.
-- Se algum dia já tem um registro (check-in real ou status manual
-- diferente do padrão), NÃO aplica nada nesse primeiro passe — devolve o
-- preview (data_referencia, conflito, aplicado=false) pro front decidir.
-- Chamando de novo com p_sobrescrever=true aplica de fato, registra em
-- audit_log e cria um alerta assíncrono pro coordenador do líder do
-- colaborador (que não está presente na hora pra confirmar).
--
-- cancelar_ferias: reverte o intervalo inteiro pro status padrão do dia
-- (FALTA em dia útil / FOLGA em fim de semana/feriado) — cancelamento é
-- tudo-ou-nada; pra ajustar datas, cancela e lança de novo.
-- =========================================================

-- ---------------------------------------------------------
-- Tabela de alertas — genérica, pra este e futuros avisos assíncronos
-- (não existia nenhuma tabela de notificação; pendências hoje são só
-- consulta ao vivo, o que não serve pra avisar quem não está na tela).
-- ---------------------------------------------------------
create table tlp_presenca.alertas (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null,
  colaborador_id uuid references tlp_presenca.colaboradores(id) on delete cascade,
  destinatario_id uuid not null references tlp_presenca.perfis(id) on delete cascade,
  detalhes       jsonb not null default '{}',
  lido           boolean not null default false,
  created_at     timestamptz not null default now()
);

comment on table tlp_presenca.alertas is
  'Avisos assíncronos endereçados a um perfil específico (ex.: coordenador avisado de uma sobrescrita de férias que ele não presenciou).';

create index alertas_destinatario_idx on tlp_presenca.alertas (destinatario_id, lido);

alter table tlp_presenca.alertas enable row level security;

create policy "alertas_select_destinatario"
  on tlp_presenca.alertas for select
  to authenticated
  using (destinatario_id = auth.uid() or tlp_presenca.sou_admin());

create policy "alertas_update_destinatario"
  on tlp_presenca.alertas for update
  to authenticated
  using (destinatario_id = auth.uid())
  with check (destinatario_id = auth.uid());

-- Sem policy de insert: só as RPCs security definer (abaixo) escrevem aqui.

-- ---------------------------------------------------------
-- aplicar_ferias
-- ---------------------------------------------------------
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
    select * into v_row from tlp_presenca.status_dia
      where colaborador_id = p_colaborador_id and data_referencia = v_data;
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

-- ---------------------------------------------------------
-- cancelar_ferias — reverte o intervalo inteiro pro status padrão do dia.
-- ---------------------------------------------------------
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
      -- p_forcar_status=false faz o servidor recalcular o repouso (FALTA/FOLGA) do dia.
      perform tlp_presenca.transicionar_status_dia(
        v_row.id, 'FALTA'::tlp_presenca.status_dia_enum, null, null, null, false
      );
    end if;
  end loop;
end;
$$;

comment on function tlp_presenca.cancelar_ferias(uuid, date, date) is
  'Reverte pro status padrão (FALTA/FOLGA recalculado) todo dia do intervalo que estava marcado como OUTROS/Férias. Cancelamento é tudo-ou-nada; ignora silenciosamente dias fora desse status.';
