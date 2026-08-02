-- =========================================================
-- 0021 · Módulo 10 — SLA de aprovação do status_dia
--
-- SLA = tempo entre o status_dia entrar em PENDENTE (check-in do técnico)
-- e ser decidido (PRESENTE/rejeitado/etc). Faixas: verde <=15min,
-- amarelo 15-30min, vermelho >30min — mais rígido que o SLA de 2h já
-- existente em vw_sla_lideres (que mede aprovação de marcações/justificativas
-- avulsas em registros_presenca/justificativas; este módulo mede o fluxo
-- novo do status_dia). Os dois convivem — não substituem um ao outro.
-- =========================================================

alter table tlp_presenca.status_dia add column entrou_pendente_em timestamptz;
comment on column tlp_presenca.status_dia.entrou_pendente_em is 'Timestamp em que o status virou PENDENTE pela última vez — base do cálculo de SLA de aprovação.';

-- Atualiza as duas funções que colocam um status_dia em PENDENTE para
-- registrar o timestamp.
create or replace function tlp_presenca.marcar_status_dia_pendente(
  p_colaborador_id uuid,
  p_registro_presenca_id uuid
)
returns tlp_presenca.status_dia
language plpgsql
security definer
set search_path = tlp_presenca
as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_status_dia tlp_presenca.status_dia;
begin
  v_status_dia := tlp_presenca.obter_ou_criar_status_dia(p_colaborador_id, v_hoje);

  if v_status_dia.status not in ('FALTA', 'FOLGA') then
    return v_status_dia;
  end if;

  update tlp_presenca.status_dia
  set status = 'PENDENTE',
      registro_presenca_id = p_registro_presenca_id,
      entrou_pendente_em = now()
  where id = v_status_dia.id
  returning * into v_status_dia;

  return v_status_dia;
end;
$$;

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
      entrou_pendente_em = case when p_novo_status = 'PENDENTE' then now() else entrou_pendente_em end,
      decidido_por = case when p_novo_status <> 'PENDENTE' then v_ator else decidido_por end,
      decidido_em = case when p_novo_status <> 'PENDENTE' then now() else decidido_em end
  where id = p_id
  returning * into v_atual;

  return v_atual;
end;
$$;

-- ---------------------------------------------------------
-- Uma linha por decisão de status_dia já concluída (saiu de PENDENTE),
-- com o tempo gasto e a faixa de SLA. Base do badge/ranking do Módulo 10.
-- ---------------------------------------------------------
create or replace view tlp_presenca.vw_sla_status_dia as
select
  sd.id as status_dia_id,
  sd.colaborador_id,
  sd.filial_id,
  f.nome as filial_nome,
  sd.data_referencia,
  sd.status as status_final,
  sd.decidido_por,
  p.nome as decidido_por_nome,
  sd.entrou_pendente_em,
  sd.decidido_em,
  round(extract(epoch from (sd.decidido_em - sd.entrou_pendente_em)) / 60.0, 1) as minutos,
  case
    when extract(epoch from (sd.decidido_em - sd.entrou_pendente_em)) / 60.0 <= 15 then 'verde'
    when extract(epoch from (sd.decidido_em - sd.entrou_pendente_em)) / 60.0 <= 30 then 'amarelo'
    else 'vermelho'
  end as faixa_sla
from tlp_presenca.status_dia sd
left join tlp_presenca.filiais f on f.id = sd.filial_id
left join tlp_presenca.perfis p on p.id = sd.decidido_por
where sd.entrou_pendente_em is not null and sd.decidido_em is not null;

comment on view tlp_presenca.vw_sla_status_dia is
  'Uma linha por decisão de status_dia concluída (saiu de PENDENTE), com tempo em minutos e faixa de SLA (verde<=15min, amarelo 15-30min, vermelho>30min).';

alter view tlp_presenca.vw_sla_status_dia set (security_invoker = true);
