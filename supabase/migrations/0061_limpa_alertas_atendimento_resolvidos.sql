-- =========================================================
-- 0061 · Alertas de atendimento (8h/12h) ficavam presos mesmo depois de
-- resolvidos
--
-- Dois bugs relacionados, achados a partir de um caso real (líder rejeitou
-- a saída e ainda marcou o dia como FOLGA, e os alertas de 8h/12h
-- continuavam aparecendo no AlertasCard):
--
-- 1. gerar_alertas_atendimento_aberto() só excluía saída com
--    status_aprovacao = 'aprovado' da condição "em aberto" — uma saída
--    REJEITADA continuava contando como pendente, gerando alertas novos
--    pra sempre.
-- 2. Uma vez inserido, um alerta nunca é "desarmado": ele fica lido=false
--    pra sempre, mesmo que a situação se resolva depois (saída decidida,
--    ou status_dia deixar de ser PRESENTE). O AlertasCard só filtra por
--    lido=false, sem checar se a condição ainda é verdadeira.
--
-- Fix: (a) exclui também status_aprovacao = 'rejeitado' da condição "em
-- aberto"; (b) a cada execução, marca como lido=true qualquer alerta desses
-- dois tipos cujo registro_presenca_id já não esteja mais na lista de
-- "ainda em aberto" — antes de gerar os novos.
-- =========================================================

create or replace function tlp_presenca.gerar_alertas_atendimento_aberto()
returns void
language plpgsql
security definer
set search_path = tlp_presenca
as $$
declare
  v_aberto record;
  v_coordenador_id uuid;
  v_ja_alertado boolean;
  v_status_saida text;
  v_horas_decorridas numeric;
  v_tipo_alerta text;
begin
  -- Limpeza: qualquer alerta não lido desses dois tipos cujo
  -- registro_presenca_id não está mais "em aberto" (saída decidida, ou
  -- status_dia mudou de PRESENTE) perdeu o sentido — marca como lido.
  update tlp_presenca.alertas a
  set lido = true
  where a.tipo in ('atendimento_pendente_fechamento', 'atendimento_sem_fechamento')
    and a.lido = false
    and not exists (
      select 1
      from tlp_presenca.status_dia sd
      where sd.registro_presenca_id = (a.detalhes->>'registro_presenca_id')::uuid
        and sd.status = 'PRESENTE'
        and not exists (
          select 1 from tlp_presenca.marcacoes_atendimento ma
          where ma.registro_presenca_entrada_id = sd.registro_presenca_id
            and ma.status_aprovacao in ('aprovado', 'rejeitado')
        )
    );

  for v_aberto in
    select
      sd.id as status_dia_id,
      sd.colaborador_id,
      sd.registro_presenca_id,
      sd.decidido_em as entrada_aprovada_em,
      c.lider_id,
      c.nome as colaborador_nome,
      c.matricula as colaborador_matricula,
      rp.latitude,
      rp.longitude,
      rp.endereco_completo,
      extract(epoch from (now() - sd.decidido_em)) / 3600 as horas_decorridas,
      (
        select ma.status_aprovacao::text from tlp_presenca.marcacoes_atendimento ma
        where ma.registro_presenca_entrada_id = sd.registro_presenca_id
      ) as status_saida
    from tlp_presenca.status_dia sd
    join tlp_presenca.colaboradores c on c.id = sd.colaborador_id
    join tlp_presenca.perfis lider on lider.id = c.lider_id
    join tlp_presenca.registros_presenca rp on rp.id = sd.registro_presenca_id
    where sd.status = 'PRESENTE'
      and lider.exige_saida_atendimento = true
      and sd.decidido_em is not null
      and sd.decidido_em <= now() - interval '8 hours'
      and sd.decidido_em >= now() - interval '48 hours' -- nunca varre histórico antigo (só recente)
      and not exists (
        select 1 from tlp_presenca.marcacoes_atendimento ma
        where ma.registro_presenca_entrada_id = sd.registro_presenca_id
          and ma.status_aprovacao in ('aprovado', 'rejeitado')
      )
  loop
    v_horas_decorridas := v_aberto.horas_decorridas;
    v_status_saida := coalesce(v_aberto.status_saida, 'sem_saida');
    v_tipo_alerta := case when v_horas_decorridas >= 12 then 'atendimento_sem_fechamento' else 'atendimento_pendente_fechamento' end;

    select exists (
      select 1 from tlp_presenca.alertas
      where tipo = v_tipo_alerta
        and colaborador_id = v_aberto.colaborador_id
        and (detalhes->>'registro_presenca_id')::uuid = v_aberto.registro_presenca_id
    ) into v_ja_alertado;

    if not v_ja_alertado then
      select coordenador_id into v_coordenador_id from tlp_presenca.perfis where id = v_aberto.lider_id;

      insert into tlp_presenca.alertas (tipo, colaborador_id, destinatario_id, detalhes)
      values (
        v_tipo_alerta, v_aberto.colaborador_id, v_aberto.lider_id,
        jsonb_build_object(
          'registro_presenca_id', v_aberto.registro_presenca_id,
          'colaborador_matricula', v_aberto.colaborador_matricula,
          'entrada_aprovada_em', v_aberto.entrada_aprovada_em,
          'horas_decorridas', round(v_horas_decorridas, 1),
          'latitude', v_aberto.latitude,
          'longitude', v_aberto.longitude,
          'endereco_completo', v_aberto.endereco_completo,
          'status_saida', v_status_saida
        )
      );

      if v_coordenador_id is not null then
        insert into tlp_presenca.alertas (tipo, colaborador_id, destinatario_id, detalhes)
        values (
          v_tipo_alerta, v_aberto.colaborador_id, v_coordenador_id,
          jsonb_build_object(
            'registro_presenca_id', v_aberto.registro_presenca_id,
            'colaborador_matricula', v_aberto.colaborador_matricula,
            'entrada_aprovada_em', v_aberto.entrada_aprovada_em,
            'horas_decorridas', round(v_horas_decorridas, 1),
            'latitude', v_aberto.latitude,
            'longitude', v_aberto.longitude,
            'endereco_completo', v_aberto.endereco_completo,
            'status_saida', v_status_saida
          )
        );
      end if;

      insert into tlp_presenca.audit_log (acao, entidade, entidade_id, detalhes)
      values (
        v_tipo_alerta, 'status_dia', v_aberto.status_dia_id,
        jsonb_build_object('colaborador_id', v_aberto.colaborador_id, 'horas_decorridas', round(v_horas_decorridas, 1))
      );
    end if;
  end loop;
end;
$$;

comment on function tlp_presenca.gerar_alertas_atendimento_aberto() is
  'A cada 30 min: 8h após a entrada aprovada sem saída decidida -> alerta "pendente de fechamento"; 12h -> alerta crítico "sem fechamento". Só considera aprovações dos últimos 2 dias. Antes de gerar novos, desarma (marca lido) alertas antigos cuja saída já foi decidida (aprovada ou rejeitada) ou cujo status_dia deixou de ser PRESENTE. Nunca altera status_dia.';

-- Limpeza imediata: desarma os alertas já presos do caso real que motivou
-- essa correção (saída rejeitada + status_dia virou FOLGA, alertas de
-- 22/08 continuavam lido=false).
update tlp_presenca.alertas a
set lido = true
where a.tipo in ('atendimento_pendente_fechamento', 'atendimento_sem_fechamento')
  and a.lido = false
  and not exists (
    select 1
    from tlp_presenca.status_dia sd
    where sd.registro_presenca_id = (a.detalhes->>'registro_presenca_id')::uuid
      and sd.status = 'PRESENTE'
      and not exists (
        select 1 from tlp_presenca.marcacoes_atendimento ma
        where ma.registro_presenca_entrada_id = sd.registro_presenca_id
          and ma.status_aprovacao in ('aprovado', 'rejeitado')
      )
  );
