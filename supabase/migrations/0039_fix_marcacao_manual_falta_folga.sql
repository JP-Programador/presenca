-- =========================================================
-- 0039 · Corrige marcação manual de FALTA/FOLGA sendo sobrescrita
--
-- Bug: transicionar_status_dia sempre trocava FALTA/FOLGA pelo "repouso"
-- recalculado do dia (FALTA em dia útil, FOLGA em fim de semana/feriado) —
-- correto pra REJEITAR (a rejeição sempre volta pro repouso certo do dia,
-- mesmo que o calendário tenha mudado depois que a linha PENDENTE foi
-- criada), mas a mesma função também atende a marcação manual do líder
-- (StatusActionMenu), e nesse caso o valor escolhido era sempre
-- sobrescrito: clicar em "Folga" num dia útil virava "Falta" sem aviso.
--
-- Correção: novo parâmetro p_forcar_status — quando true, o status pedido
-- vale como está, sem recalcular repouso. A marcação manual do líder passa
-- true; a rejeição automática continua false (mantém o recálculo).
-- =========================================================

-- create or replace NÃO troca a assinatura antiga (5 args) por essa (6 args)
-- — no Postgres, identidade de função é pelos tipos dos parâmetros; um
-- parâmetro a mais cria uma SOBRECARGA nova, deixando a antiga (com o bug)
-- ativa e ambígua com chamadas de 5 argumentos. Precisa dropar antes.
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
begin
  select * into v_atual from tlp_presenca.status_dia where id = p_id for update;
  if not found then
    raise exception 'status_dia % não encontrado', p_id;
  end if;

  if not (
    tlp_presenca.sou_admin()
    or tlp_presenca.gerencio_filial(v_atual.filial_id)
    or tlp_presenca.sou_lider_do_colaborador(v_atual.colaborador_id)
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
    null;
  elsif p_novo_status in ('FALTA', 'FOLGA') then
    -- Rejeição automática (p_forcar_status = false): sempre volta pro repouso
    -- recalculado contra o calendário atual. Marcação manual do líder
    -- (p_forcar_status = true): vale o status escolhido, sem recálculo.
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
  'Aplica uma transição validada de status_dia. p_forcar_status=true (marcação manual do líder) faz o status pedido valer como está, sem recalcular repouso pro par FALTA/FOLGA.';
