-- =========================================================
-- 0025 · Correção de revisão — marcação manual "Presente" a partir de
-- qualquer status
--
-- Bug: transicionar_status_dia só aceitava PRESENTE vindo de
-- PENDENTE/FALTA/FOLGA, mas o StatusActionMenu (Módulo 7) oferece o botão
-- "Presente" em QUALQUER status (inclusive ATESTADO/OUTROS, para o líder
-- corrigir uma marcação indevida). Clicar nesse botão a partir de
-- ATESTADO/OUTROS sempre falhava com "Transição para PRESENTE inválida".
--
-- Correção: PRESENTE alcançado via fluxo automático (aprovação, a partir de
-- PENDENTE) continua exigindo PENDENTE; alcançado via marcação manual do
-- líder (a partir de qualquer status) passa a ser aceito — mesma regra que
-- já valia para FALTA/FOLGA/ATESTADO/OUTROS manuais.
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
    -- Aprovação automática (a partir de PENDENTE) ou marcação manual do
    -- líder a partir de qualquer status (ex.: corrigir um ATESTADO indevido).
    null;
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
      entrou_pendente_em = case when p_novo_status = 'PENDENTE' then now() else entrou_pendente_em end,
      decidido_por = case when p_novo_status <> 'PENDENTE' then v_ator else decidido_por end,
      decidido_em = case when p_novo_status <> 'PENDENTE' then now() else decidido_em end
  where id = p_id
  returning * into v_atual;

  return v_atual;
end;
$$;
