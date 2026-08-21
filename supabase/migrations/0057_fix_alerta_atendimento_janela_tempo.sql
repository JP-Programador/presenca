-- =========================================================
-- 0057 · Corrige gerar_alertas_atendimento_aberto varrendo histórico inteiro
--
-- Bug real: a consulta não tinha limite de "até quando olhar pra trás" —
-- só `decidido_em <= now() - 8h`, sem teto. Assim que QUALQUER líder liga
-- "Presença (entrada e saída)", toda presença aprovada dele desde sempre
-- (mesmo de antes dessa feature existir, sem chance de ter uma saída
-- vinculada) virava alerta "sem fechamento" — gerou 94 alertas de uma vez
-- só pro time de um líder real. Corrige limitando a janela a 48h — depois
-- disso não faz mais sentido cobrar fechamento de atendimento, é assunto
-- de outra conversa (RH), não desse alerta automático.
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
          and ma.status_aprovacao = 'aprovado'
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
  'A cada 30 min: 8h após a entrada aprovada sem saída aprovada -> alerta "pendente de fechamento"; 12h -> alerta crítico "sem fechamento". Só considera aprovações dos últimos 2 dias (nunca varre histórico antigo). Nunca altera status_dia (técnico continua PRESENTE).';

-- Limpa os alertas incorretos gerados pelo bug (presença antiga sem
-- possibilidade de ter tido uma saída vinculada, já que a feature nem
-- existia quando foram aprovadas).
delete from tlp_presenca.alertas
where tipo in ('atendimento_pendente_fechamento', 'atendimento_sem_fechamento')
  and (detalhes->>'entrada_aprovada_em')::timestamptz < now() - interval '48 hours';
