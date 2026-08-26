-- =========================================================
-- 0065 · Notificações push (Web Push) — lembretes de pendência
--
-- Líder: 08:00/08:30/09:00 "X ainda não lançaram" (lembrete), 09:15 "X
-- estão com FALTA por não lançarem" (final, já depois do corte). Coordenador:
-- 08:30 "X líderes com pendência, Y%", 09:15 resumo final. Nada disso muda
-- status_dia nem cria linha em alertas — é só notificação no navegador.
-- =========================================================

create table tlp_presenca.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  perfil_id   uuid not null references tlp_presenca.perfis(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

comment on table tlp_presenca.push_subscriptions is
  'Inscrições de Web Push por usuário (líder/coordenador) — um mesmo perfil pode ter várias (um por dispositivo/navegador).';

create index push_subscriptions_perfil_id_idx on tlp_presenca.push_subscriptions (perfil_id);

alter table tlp_presenca.push_subscriptions enable row level security;

create policy "push_subscriptions_select_proprio"
  on tlp_presenca.push_subscriptions for select
  to authenticated
  using (perfil_id = auth.uid());

create policy "push_subscriptions_insert_proprio"
  on tlp_presenca.push_subscriptions for insert
  to authenticated
  with check (perfil_id = auth.uid());

create policy "push_subscriptions_delete_proprio"
  on tlp_presenca.push_subscriptions for delete
  to authenticated
  using (perfil_id = auth.uid());

-- ---------------------------------------------------------
-- Quantos colaboradores de um líder ainda "não lançaram" hoje — mesma
-- definição já usada no filtro "Não lançaram" do painel (FALTA/FOLGA sem
-- decisão humana ainda).
-- ---------------------------------------------------------
create or replace function tlp_presenca.contar_nao_lancaram_por_lider()
returns table(lider_id uuid, total integer)
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select c.lider_id, count(*)::integer as total
  from tlp_presenca.status_dia sd
  join tlp_presenca.colaboradores c on c.id = sd.colaborador_id
  where sd.data_referencia = (now() at time zone 'America/Sao_Paulo')::date
    and sd.status in ('FALTA', 'FOLGA')
    and sd.decidido_por is null
    and c.lider_id is not null
    and c.ativo = true
  group by c.lider_id;
$$;

comment on function tlp_presenca.contar_nao_lancaram_por_lider() is
  'Uma linha por líder com pelo menos 1 colaborador ainda sem lançar presença hoje — base dos lembretes push do líder.';

-- ---------------------------------------------------------
-- Resumo pro coordenador: quantos líderes da própria hierarquia estão com
-- pendência (>=1 colaborador sem lançar), e qual % da equipe toda dele
-- ainda não lançou.
-- ---------------------------------------------------------
create or replace function tlp_presenca.resumo_nao_lancaram_por_coordenador()
returns table(coordenador_id uuid, lideres_pendentes integer, total_colaboradores integer, colaboradores_pendentes integer)
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select
    lider.coordenador_id,
    count(distinct nl.lider_id)::integer as lideres_pendentes,
    (
      select count(*)::integer from tlp_presenca.colaboradores c2
      join tlp_presenca.perfis l2 on l2.id = c2.lider_id
      where l2.coordenador_id = lider.coordenador_id and c2.ativo = true
    ) as total_colaboradores,
    coalesce(sum(nl.total), 0)::integer as colaboradores_pendentes
  from tlp_presenca.contar_nao_lancaram_por_lider() nl
  join tlp_presenca.perfis lider on lider.id = nl.lider_id
  where lider.coordenador_id is not null
  group by lider.coordenador_id;
$$;

comment on function tlp_presenca.resumo_nao_lancaram_por_coordenador() is
  'Uma linha por coordenador: quantos líderes da hierarquia dele têm pendência hoje e qual % da equipe toda ainda não lançou — base do lembrete push do coordenador.';
