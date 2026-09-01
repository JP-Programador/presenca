-- =========================================================
-- 0069 · Líder que só marca manual pode dispensar o mapa
--
-- Alguns líderes (ex.: supervisor de base) nunca usam check-in por GPS —
-- marcam a presença da equipe manualmente o tempo todo. Pra esses, o
-- "Mapa da equipe" e a tabela "Marcações perto de casa" não servem pra
-- nada (nunca têm ponto pra mostrar) — o próprio líder pode desligar.
-- Mesmo padrão já usado por exige_saida_atendimento: coluna em perfis +
-- RPC que só mexe no próprio perfil.
-- =========================================================

alter table tlp_presenca.perfis add column dispensa_mapa boolean not null default false;
comment on column tlp_presenca.perfis.dispensa_mapa is
  'Só relevante quando perfil = gestor: true = líder marca presença sempre manual, esconde o mapa e a tabela de check-in perto de casa no painel dele.';

create or replace function tlp_presenca.atualizar_meu_dispensa_mapa(p_dispensa boolean)
returns void
language plpgsql
security definer
set search_path = tlp_presenca
as $$
begin
  if not exists (select 1 from tlp_presenca.perfis where id = auth.uid() and perfil = 'gestor') then
    raise exception 'Só líderes (gestor) configuram isso do próprio painel';
  end if;

  update tlp_presenca.perfis set dispensa_mapa = p_dispensa where id = auth.uid();
end;
$$;

comment on function tlp_presenca.atualizar_meu_dispensa_mapa(boolean) is
  'Líder liga/desliga a exibição do mapa/check-ins perto de casa no próprio painel — não afeta o fluxo de marcação em si, só a UI.';
