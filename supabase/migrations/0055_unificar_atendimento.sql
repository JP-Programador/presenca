-- =========================================================
-- 0055 · Unifica presença e atendimento no mesmo link público
--
-- Ajuste de arquitetura: a 0053 criou o atendimento como conceito
-- paralelo (tela própria, tabela com entrada+saída independentes,
-- casadas por data). O diretor pediu UM SÓ link público — o servidor
-- decide sozinho, pelo estado no banco, se a próxima marcação é entrada
-- ou saída, nunca o técnico escolhendo.
--
-- Redesenho: a ENTRADA deixa de existir como conceito de atendimento —
-- vira exatamente a entrada de presença de sempre (registros_presenca +
-- status_dia + aprovação via StatusActionMenu, tudo já existente e
-- inalterado). "marcacoes_atendimento" vira SÓ a tabela de SAÍDA,
-- ligada por FK direta ao registros_presenca da entrada
-- (registro_presenca_entrada_id) em vez de casar por data — isso
-- resolve a virada de dia de graça (a saída não precisa "pertencer" à
-- mesma data da entrada, só apontar pra ela) e tem aprovação própria,
-- que nunca mexe em status_dia.
--
-- Essas peças (tipo/unique por data, gerar_alertas_atendimento_sem_saida)
-- nunca foram usadas em produção — só em testes descartáveis desta
-- sessão — por isso é seguro alterar em vez de versionar com cuidado.
-- =========================================================

select cron.unschedule('tlp-alertas-atendimento-sem-saida');
drop function tlp_presenca.gerar_alertas_atendimento_sem_saida();

-- Linhas existentes são só testes manuais desta sessão (chegada/saída
-- casadas por data, sem nenhuma entrada real de registros_presenca pra
-- vincular) — estruturalmente incompatíveis com o novo desenho, não dá
-- pra migrar; removidas antes de trocar o formato da tabela.
delete from tlp_presenca.marcacoes_atendimento;

alter table tlp_presenca.marcacoes_atendimento
  drop constraint marcacoes_atendimento_colaborador_dia_tipo_unique;
alter table tlp_presenca.marcacoes_atendimento
  drop column tipo;
drop type tlp_presenca.tipo_marcacao_atendimento;

create type tlp_presenca.status_aprovacao_atendimento as enum ('pendente', 'aprovado', 'rejeitado');

alter table tlp_presenca.marcacoes_atendimento
  add column registro_presenca_entrada_id uuid not null references tlp_presenca.registros_presenca(id) on delete cascade,
  add column status_aprovacao tlp_presenca.status_aprovacao_atendimento not null default 'pendente',
  add column aprovado_por uuid references tlp_presenca.perfis(id),
  add column aprovado_em timestamptz,
  add constraint marcacoes_atendimento_entrada_unique unique (registro_presenca_entrada_id);

comment on table tlp_presenca.marcacoes_atendimento is
  'Saída/finalização de atendimento — vinculada à entrada (registros_presenca.tipo=entrada) que a originou. A entrada em si é presença normal (status_dia); a saída tem aprovação própria e nunca mexe em status_dia.';
comment on column tlp_presenca.marcacoes_atendimento.registro_presenca_entrada_id is
  'A entrada (registros_presenca) que esta saída fecha — não precisa ser do mesmo dia (jornadas que viram a noite ficam corretamente vinculadas).';

-- Entrada também passa a guardar o endereço (reverso) — registros_presenca
-- nunca teve isso, e o relatório de atendimento precisa mostrar endereço
-- de entrada E de saída.
alter table tlp_presenca.registros_presenca add column endereco_completo text;
comment on column tlp_presenca.registros_presenca.endereco_completo is
  'Geocodificação reversa da coordenada do check-in, resolvida no momento da marcação. Null se falhar — nunca bloqueia o registro.';

-- ---------------------------------------------------------
-- Única fonte da verdade sobre a próxima marcação de um colaborador —
-- chamada tanto por validar-colaborador (preview, só leitura) quanto por
-- checkin-publico (decisão real). Nunca confia no tipo que o front manda.
-- ---------------------------------------------------------
create or replace function tlp_presenca.proximo_tipo_marcacao(p_colaborador_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = tlp_presenca
as $$
declare
  v_entrada_aberta uuid;
begin
  select rp.id into v_entrada_aberta
  from tlp_presenca.registros_presenca rp
  where rp.colaborador_id = p_colaborador_id
    and rp.tipo = 'entrada'
    and not exists (
      select 1 from tlp_presenca.marcacoes_atendimento ma
      where ma.registro_presenca_entrada_id = rp.id
    )
  order by rp.horario_registrado desc
  limit 1;

  if v_entrada_aberta is not null then
    return 'saida';
  end if;
  return 'entrada';
end;
$$;

comment on function tlp_presenca.proximo_tipo_marcacao(uuid) is
  'Entrada aberta (sem saída vinculada) = próxima marcação é saída, independente da data (suporta jornada que vira a noite). Sem entrada aberta = próxima marcação é entrada.';

-- ---------------------------------------------------------
-- Aprovação da saída — independente da aprovação da entrada
-- (status_dia). Mesmo padrão de permissão de transicionar_status_dia.
-- ---------------------------------------------------------
create or replace function tlp_presenca.aprovar_saida_atendimento(p_marcacao_id uuid, p_aprovar boolean)
returns tlp_presenca.marcacoes_atendimento
language plpgsql
security definer
set search_path = tlp_presenca
as $$
declare
  v_marcacao tlp_presenca.marcacoes_atendimento;
  v_ator uuid := auth.uid();
begin
  select * into v_marcacao from tlp_presenca.marcacoes_atendimento where id = p_marcacao_id for update;
  if not found then
    raise exception 'Marcação de atendimento % não encontrada', p_marcacao_id;
  end if;

  if not (
    tlp_presenca.sou_admin()
    or tlp_presenca.sou_gerente()
    or tlp_presenca.sou_lider_do_colaborador(v_marcacao.colaborador_id)
    or (tlp_presenca.sou_coordenador() and tlp_presenca.sou_coordenador_do_colaborador(v_marcacao.colaborador_id))
  ) then
    raise exception 'Sem permissão para decidir esta saída de atendimento';
  end if;

  update tlp_presenca.marcacoes_atendimento
  set status_aprovacao = case when p_aprovar then 'aprovado' else 'rejeitado' end,
      aprovado_por = v_ator,
      aprovado_em = now()
  where id = p_marcacao_id
  returning * into v_marcacao;

  insert into tlp_presenca.audit_log (ator_id, acao, entidade, entidade_id, detalhes)
  values (
    v_ator,
    case when p_aprovar then 'atendimento_saida_aprovada' else 'atendimento_saida_rejeitada' end,
    'marcacoes_atendimento', p_marcacao_id,
    jsonb_build_object('colaborador_id', v_marcacao.colaborador_id)
  );

  return v_marcacao;
end;
$$;

comment on function tlp_presenca.aprovar_saida_atendimento(uuid, boolean) is
  'Aprova/rejeita a saída de um atendimento. Nunca mexe em status_dia — a presença do dia já foi decidida na aprovação da entrada.';

-- ---------------------------------------------------------
-- Alertas de fechamento (8h/12h após a ENTRADA ser aprovada) — roda a
-- cada 30 min (mesma cadência de delete-old-photos), não 1x/dia, já que
-- os cortes são por hora corrida, não por virada de data. Nunca altera
-- status_dia — o técnico continua PRESENTE mesmo com o alerta crítico.
-- ---------------------------------------------------------
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
  'A cada 30 min: 8h após a entrada aprovada sem saída aprovada -> alerta "pendente de fechamento"; 12h -> alerta crítico "sem fechamento". Nunca altera status_dia (técnico continua PRESENTE).';

select cron.schedule(
  'tlp-alertas-atendimento-aberto',
  '*/30 * * * *',
  $$ select tlp_presenca.gerar_alertas_atendimento_aberto(); $$
);

-- ---------------------------------------------------------
-- Gerente e auditor viam "vazio" antes (RLS de alertas só tinha admin
-- como bypass) — agora enxergam qualquer alerta, sem precisar ser o
-- destinatario_id de cada linha (líder/coordenador continuam vendo só
-- os endereçados a eles, como já era).
-- ---------------------------------------------------------
drop policy if exists "alertas_select_destinatario" on tlp_presenca.alertas;
create policy "alertas_select_destinatario"
  on tlp_presenca.alertas for select
  to authenticated
  using (
    destinatario_id = auth.uid()
    or tlp_presenca.sou_admin()
    or tlp_presenca.sou_gerente()
    or tlp_presenca.sou_auditor()
  );
