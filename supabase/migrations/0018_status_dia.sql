-- =========================================================
-- 0018 · Módulo 6 — Nova regra de status do dia
--
-- Introduz o conceito de "status do dia" por colaborador, independente
-- das marcações individuais em registros_presenca:
--
--   Dias ÚTEIS       -> todo colaborador ativo inicia o dia como FALTA
--   SÁBADO/DOMINGO/FERIADO -> todo colaborador ativo inicia como FOLGA
--
--   Fluxo:    FALTA/FOLGA -> PENDENTE -> PRESENTE
--   Rejeição: PENDENTE -> FALTA (dia útil) ou FOLGA (fim de semana/feriado)
--   Manuais (líder): PRESENTE, FALTA, ATESTADO, FOLGA, OUTROS
-- =========================================================

create type tlp_presenca.status_dia_enum as enum (
  'FALTA', 'FOLGA', 'PENDENTE', 'PRESENTE', 'ATESTADO', 'OUTROS'
);

create type tlp_presenca.motivo_outros_enum as enum (
  'Férias', 'Treinamento', 'Afastamento', 'Banco de horas', 'Plantão não escalado', 'Outro'
);

create table tlp_presenca.status_dia (
  id                  uuid primary key default gen_random_uuid(),
  colaborador_id      uuid not null references tlp_presenca.colaboradores(id) on delete cascade,
  filial_id           uuid not null references tlp_presenca.filiais(id) on delete restrict,
  data_referencia     date not null,
  tipo_dia            tlp_presenca.tipo_dia not null,          -- snapshot da classificação do dia (Módulo 5)
  status              tlp_presenca.status_dia_enum not null,
  registro_presenca_id uuid references tlp_presenca.registros_presenca(id) on delete set null,
  motivo_outros       tlp_presenca.motivo_outros_enum,          -- obrigatório quando status = 'OUTROS'
  observacao          text,
  decidido_por        uuid references tlp_presenca.perfis(id) on delete set null,
  decidido_em         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint status_dia_colaborador_data_unique unique (colaborador_id, data_referencia),
  constraint status_dia_outros_exige_motivo check (
    status <> 'OUTROS' or motivo_outros is not null
  )
);

comment on table tlp_presenca.status_dia is
  'Status diário de presença por colaborador (FALTA/FOLGA/PENDENTE/PRESENTE/ATESTADO/OUTROS), independente das marcações individuais em registros_presenca.';

create index status_dia_data_idx on tlp_presenca.status_dia (data_referencia);
create index status_dia_filial_data_idx on tlp_presenca.status_dia (filial_id, data_referencia);
create index status_dia_status_idx on tlp_presenca.status_dia (status);

create trigger status_dia_set_updated_at
  before update on tlp_presenca.status_dia
  for each row execute function tlp_presenca.set_updated_at();

-- ---------------------------------------------------------
-- Estado inicial do dia, conforme a classificação do calendário (Módulo 5)
-- ---------------------------------------------------------
create or replace function tlp_presenca.status_inicial_dia(p_tipo_dia tlp_presenca.tipo_dia)
returns tlp_presenca.status_dia_enum
language sql
immutable
as $$
  select case when p_tipo_dia = 'UTIL' then 'FALTA'::tlp_presenca.status_dia_enum
              else 'FOLGA'::tlp_presenca.status_dia_enum
         end;
$$;

-- ---------------------------------------------------------
-- Gera (idempotente) as linhas de status_dia para todos os colaboradores
-- ativos numa data. Chamada pelo cron diário e, sob demanda, pela função
-- obter_ou_criar_status_dia abaixo.
-- ---------------------------------------------------------
create or replace function tlp_presenca.gerar_status_dia(p_data date)
returns void
language plpgsql
security definer
set search_path = tlp_presenca
as $$
declare
  v_tipo_dia tlp_presenca.tipo_dia := tlp_presenca.tipo_dia_calendario(p_data);
begin
  insert into tlp_presenca.status_dia (colaborador_id, filial_id, data_referencia, tipo_dia, status)
  select c.id, c.filial_id, p_data, v_tipo_dia, tlp_presenca.status_inicial_dia(v_tipo_dia)
  from tlp_presenca.colaboradores c
  where c.ativo = true
  on conflict (colaborador_id, data_referencia) do nothing;
end;
$$;

comment on function tlp_presenca.gerar_status_dia(date) is
  'Cria o status inicial (FALTA/FOLGA) do dia para todo colaborador ativo que ainda não tem linha em status_dia nessa data. Idempotente.';

-- Garante a linha do dia para um colaborador específico e a devolve (usado pelo check-in público e pelos dashboards).
create or replace function tlp_presenca.obter_ou_criar_status_dia(p_colaborador_id uuid, p_data date)
returns tlp_presenca.status_dia
language plpgsql
security definer
set search_path = tlp_presenca
as $$
declare
  v_row tlp_presenca.status_dia;
  v_filial_id uuid;
  v_tipo_dia tlp_presenca.tipo_dia;
begin
  select * into v_row from tlp_presenca.status_dia
  where colaborador_id = p_colaborador_id and data_referencia = p_data;

  if found then
    return v_row;
  end if;

  select filial_id into v_filial_id from tlp_presenca.colaboradores where id = p_colaborador_id;
  v_tipo_dia := tlp_presenca.tipo_dia_calendario(p_data);

  insert into tlp_presenca.status_dia (colaborador_id, filial_id, data_referencia, tipo_dia, status)
  values (p_colaborador_id, v_filial_id, p_data, v_tipo_dia, tlp_presenca.status_inicial_dia(v_tipo_dia))
  on conflict (colaborador_id, data_referencia) do nothing
  returning * into v_row;

  if not found then
    select * into v_row from tlp_presenca.status_dia
    where colaborador_id = p_colaborador_id and data_referencia = p_data;
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------
-- Transição de estado no banco (defesa em profundidade — a validação
-- "fina" também vive em src/lib/statusMachine.ts no frontend).
-- Só aceita as transições previstas no fluxo; lança exceção fora delas.
-- ---------------------------------------------------------
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

  -- Autorização explícita: como esta função é SECURITY DEFINER, ela roda
  -- ignorando a RLS da tabela — sem esta checagem, qualquer usuário
  -- autenticado poderia alterar o status de qualquer colaborador de
  -- qualquer filial só sabendo o id da linha.
  if not (
    tlp_presenca.sou_admin()
    or tlp_presenca.gerencio_filial(v_atual.filial_id)
    or tlp_presenca.pode_decidir_presenca()
    or (v_atual.colaborador_id = tlp_presenca.meu_colaborador_id() and p_novo_status = 'PENDENTE')
  ) then
    raise exception 'Sem permissão para alterar este status_dia';
  end if;

  -- Recalcula a classificação do dia contra o calendário ATUAL (não o snapshot
  -- salvo na criação da linha) — se um feriado for cadastrado depois, uma
  -- rejeição feita a partir de agora já considera o dia como FOLGA.
  v_tipo_dia_atual := tlp_presenca.tipo_dia_calendario(v_atual.data_referencia);
  v_estado_repouso := tlp_presenca.status_inicial_dia(v_tipo_dia_atual); -- FALTA ou FOLGA

  -- Transições automáticas do fluxo (check-in / aprovação / rejeição)
  if p_novo_status = 'PENDENTE' then
    if v_atual.status not in ('FALTA', 'FOLGA') then
      raise exception 'Só é possível enviar para PENDENTE a partir de FALTA/FOLGA (atual: %)', v_atual.status;
    end if;
  elsif p_novo_status = 'PRESENTE' then
    if v_atual.status not in ('PENDENTE', 'FALTA', 'FOLGA') then
      raise exception 'Transição para PRESENTE inválida a partir de %', v_atual.status;
    end if;
  elsif p_novo_status in ('FALTA', 'FOLGA') then
    -- rejeição (volta ao repouso) ou marcação manual do líder para FALTA/FOLGA.
    -- Em ambos os casos, o valor efetivo é sempre o repouso recalculado contra
    -- o calendário atual: feriado/fim de semana vira FOLGA automaticamente,
    -- mesmo que o líder tenha tentado marcar FALTA manualmente nesse dia.
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

  return v_atual;
end;
$$;

comment on function tlp_presenca.transicionar_status_dia(uuid, tlp_presenca.status_dia_enum, uuid, tlp_presenca.motivo_outros_enum, text) is
  'Aplica uma transição validada de status_dia. Chamada pelos services do frontend (RLS + esta função garantem a máquina de estados no servidor).';

-- ---------------------------------------------------------
-- RLS — mesma hierarquia de visibilidade de colaboradores/registros_presenca
-- ---------------------------------------------------------
alter table tlp_presenca.status_dia enable row level security;

create policy "status_dia_select"
  on tlp_presenca.status_dia for select
  to authenticated
  using (
    tlp_presenca.sou_admin()
    or tlp_presenca.gerencio_filial(filial_id)
    or colaborador_id = tlp_presenca.meu_colaborador_id()
  );

-- Insert direto só para admin/gestor (o fluxo normal usa as funções security definer acima,
-- que rodam com privilégio próprio; a Edge Function de check-in público usa a service_role).
create policy "status_dia_insert_gestor"
  on tlp_presenca.status_dia for insert
  to authenticated
  with check (tlp_presenca.sou_admin() or tlp_presenca.gerencio_filial(filial_id));

create policy "status_dia_update_gestor"
  on tlp_presenca.status_dia for update
  to authenticated
  using (tlp_presenca.sou_admin() or tlp_presenca.gerencio_filial(filial_id))
  with check (tlp_presenca.sou_admin() or tlp_presenca.gerencio_filial(filial_id));

create policy "status_dia_delete_admin"
  on tlp_presenca.status_dia for delete
  to authenticated
  using (tlp_presenca.sou_admin());

-- ---------------------------------------------------------
-- Agendamento: gera o status do dia (FALTA/FOLGA) para todos os
-- colaboradores ativos, logo após a meia-noite (horário de São Paulo).
-- Nome prefixado com "tlp-" pelo mesmo motivo do job da 0007 (cron.job é
-- compartilhado entre todos os projetos do banco).
-- ---------------------------------------------------------
select cron.schedule(
  'tlp-gerar-status-dia-diario',
  '5 3 * * *', -- 03:05 UTC = 00:05 America/Sao_Paulo (sem DST hoje)
  $$ select tlp_presenca.gerar_status_dia((now() at time zone 'America/Sao_Paulo')::date); $$
);

-- Para remover o agendamento, se necessário:
-- select cron.unschedule('tlp-gerar-status-dia-diario');
