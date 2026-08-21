-- =========================================================
-- 0053 · Check-in/check-out de atendimento
--
-- Evento separado da presença diária (registros_presenca/status_dia):
-- colaborador registra chegada (e, se o líder exigir, saída) numa visita
-- a cliente. Nunca afeta status_dia — esquecer a saída não vira Falta,
-- só gera um alerta separado pro líder. Chegada e saída exigem foto+GPS,
-- igual ao check-in de presença normal.
-- =========================================================

create type tlp_presenca.tipo_marcacao_atendimento as enum ('entrada', 'saida');

alter table tlp_presenca.perfis
  add column exige_saida_atendimento boolean not null default false;
comment on column tlp_presenca.perfis.exige_saida_atendimento is
  'Só relevante quando perfil = gestor: true = a equipe inteira desse líder precisa registrar também a saída do atendimento, não só a chegada.';

create table tlp_presenca.marcacoes_atendimento (
  id                  uuid primary key default gen_random_uuid(),
  colaborador_id      uuid not null references tlp_presenca.colaboradores(id) on delete cascade,
  filial_id           uuid not null references tlp_presenca.filiais(id) on delete restrict,
  data_referencia     date not null,
  tipo                tlp_presenca.tipo_marcacao_atendimento not null,
  horario_registrado  timestamptz not null default now(),
  latitude            double precision not null,
  longitude           double precision not null,
  precisao_metros     double precision,
  foto_path           text not null,
  foto_expira_em      timestamptz,
  endereco_completo   text,
  created_at          timestamptz not null default now(),

  constraint marcacoes_atendimento_colaborador_dia_tipo_unique unique (colaborador_id, data_referencia, tipo)
);

comment on table tlp_presenca.marcacoes_atendimento is
  'Chegada/saída de atendimento (visita a cliente) — independente de registros_presenca/status_dia, nunca conta como falta.';
comment on column tlp_presenca.marcacoes_atendimento.endereco_completo is
  'Geocodificação reversa da coordenada, resolvida no momento da marcação. Null se a geocodificação falhar — nunca bloqueia o registro.';

create index marcacoes_atendimento_data_idx on tlp_presenca.marcacoes_atendimento (data_referencia);
create index marcacoes_atendimento_colaborador_idx on tlp_presenca.marcacoes_atendimento (colaborador_id, data_referencia);

-- Mesmo trigger que já calcula foto_expira_em (horario_registrado + 24h)
-- pra registros_presenca e marcacoes_dia — reaproveita, não duplica lógica.
create trigger marcacoes_atendimento_set_foto_expira_em
  before insert on tlp_presenca.marcacoes_atendimento
  for each row execute function tlp_presenca.set_foto_expira_em();

-- ---------------------------------------------------------
-- RLS — mesma visibilidade já usada em registros_presenca/status_dia.
-- Sem policy de insert: só a Edge Function (service_role) grava.
-- ---------------------------------------------------------
alter table tlp_presenca.marcacoes_atendimento enable row level security;

create policy "marcacoes_atendimento_select"
  on tlp_presenca.marcacoes_atendimento for select
  to authenticated
  using (
    tlp_presenca.sou_admin()
    or tlp_presenca.sou_gerente()
    or tlp_presenca.sou_auditor()
    or tlp_presenca.sou_lider_do_colaborador(colaborador_id)
    or (tlp_presenca.sou_coordenador() and tlp_presenca.sou_coordenador_do_colaborador(colaborador_id))
  );

-- ---------------------------------------------------------
-- Líder liga/desliga a exigência de saída pra própria equipe, sem
-- precisar de uma policy de update ampla em "perfis" só pra essa coluna.
-- ---------------------------------------------------------
create or replace function tlp_presenca.atualizar_meu_modo_atendimento(p_exige_saida boolean)
returns void
language plpgsql
security definer
set search_path = tlp_presenca
as $$
begin
  if not exists (select 1 from tlp_presenca.perfis where id = auth.uid() and perfil = 'gestor') then
    raise exception 'Só líderes (gestor) configuram o atendimento da própria equipe';
  end if;

  update tlp_presenca.perfis set exige_saida_atendimento = p_exige_saida where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------
-- Alerta (não falta) quando a saída é exigida e não foi registrada até o
-- fim do dia. Idempotente por dia (não duplica se já tiver alerta).
-- ---------------------------------------------------------
create or replace function tlp_presenca.gerar_alertas_atendimento_sem_saida()
returns void
language plpgsql
security definer
set search_path = tlp_presenca
as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_pendente record;
  v_coordenador_id uuid;
  v_ja_alertado boolean;
begin
  for v_pendente in
    select ent.colaborador_id, ent.filial_id, ent.id as marcacao_id, c.lider_id
    from tlp_presenca.marcacoes_atendimento ent
    join tlp_presenca.colaboradores c on c.id = ent.colaborador_id
    join tlp_presenca.perfis lider on lider.id = c.lider_id
    where ent.tipo = 'entrada'
      and ent.data_referencia = v_hoje
      and lider.exige_saida_atendimento = true
      and not exists (
        select 1 from tlp_presenca.marcacoes_atendimento sai
        where sai.colaborador_id = ent.colaborador_id
          and sai.data_referencia = v_hoje
          and sai.tipo = 'saida'
      )
  loop
    select exists (
      select 1 from tlp_presenca.alertas
      where tipo = 'atendimento_sem_saida'
        and colaborador_id = v_pendente.colaborador_id
        and created_at::date = v_hoje
    ) into v_ja_alertado;

    if not v_ja_alertado then
      select coordenador_id into v_coordenador_id from tlp_presenca.perfis where id = v_pendente.lider_id;

      insert into tlp_presenca.alertas (tipo, colaborador_id, destinatario_id, detalhes)
      values (
        'atendimento_sem_saida', v_pendente.colaborador_id, v_pendente.lider_id,
        jsonb_build_object('data_referencia', v_hoje, 'marcacao_id', v_pendente.marcacao_id)
      );

      if v_coordenador_id is not null then
        insert into tlp_presenca.alertas (tipo, colaborador_id, destinatario_id, detalhes)
        values (
          'atendimento_sem_saida', v_pendente.colaborador_id, v_coordenador_id,
          jsonb_build_object('data_referencia', v_hoje, 'marcacao_id', v_pendente.marcacao_id)
        );
      end if;
    end if;
  end loop;
end;
$$;

comment on function tlp_presenca.gerar_alertas_atendimento_sem_saida() is
  'Roda 1x/dia à noite (pg_cron) — alerta o líder/coordenador quando uma equipe que exige saída de atendimento tem chegada sem saída no dia. Nunca mexe em status_dia.';

-- 22:00 America/Sao_Paulo = 01:00 UTC (sem DST hoje).
select cron.schedule(
  'tlp-alertas-atendimento-sem-saida',
  '0 1 * * *',
  $$ select tlp_presenca.gerar_alertas_atendimento_sem_saida(); $$
);
