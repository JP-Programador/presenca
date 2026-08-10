-- =========================================================
-- 0041 · Coordenador deixa de ter visão global — só vê a própria hierarquia
--
-- Desde a 0011, visao_global() (= admin OU auditor OU coordenador) dava a
-- QUALQUER coordenador acesso de leitura a colaboradores/usuários/status_dia/
-- registros_presenca/justificativas/fotos de TODA a empresa, inclusive
-- equipes de outros coordenadores — sem isolamento nenhum entre eles.
--
-- admin e auditor continuam com visão global (intencional: auditor existe
-- justamente pra auditoria ampla, admin é dono do sistema). Coordenador
-- passa a enxergar só: os líderes que ele mesmo criou (perfis.coordenador_id)
-- e os colaboradores desses líderes (colaboradores.lider_id) — mesmo
-- princípio já usado pro líder direto (0028), um nível acima.
--
-- vw_sla_lideres, vw_sla_status_dia e vw_mapa_operacional são
-- security_invoker=true (views "normais" que respeitam RLS de quem
-- consulta) — então escopar status_dia/registros_presenca aqui já basta
-- pra Ranking de líderes/SLA/Mapa operacional ficarem escopados também,
-- sem precisar mexer nas views.
-- =========================================================

create or replace function tlp_presenca.sou_coordenador_do_lider(p_lider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select exists (
    select 1 from tlp_presenca.perfis where id = p_lider_id and coordenador_id = auth.uid()
  );
$$;

create or replace function tlp_presenca.sou_coordenador_do_colaborador(p_colaborador_id uuid)
returns boolean
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select exists (
    select 1
    from tlp_presenca.colaboradores c
    join tlp_presenca.perfis l on l.id = c.lider_id
    where c.id = p_colaborador_id and l.coordenador_id = auth.uid()
  );
$$;

-- true se o usuário atual pode VER a linha de um colaborador: admin/auditor
-- (global) ou coordenador escopado à própria hierarquia de líderes.
create or replace function tlp_presenca.visao_coordenacao_colaborador(p_colaborador_id uuid)
returns boolean
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select
    tlp_presenca.sou_admin()
    or tlp_presenca.sou_auditor()
    or (tlp_presenca.sou_coordenador() and tlp_presenca.sou_coordenador_do_colaborador(p_colaborador_id));
$$;

-- true se o usuário atual pode VER a linha de um perfil (líder, ou
-- colaborador com login próprio): admin/auditor (global) ou coordenador
-- escopado — o alvo é um líder dele, ou um colaborador com login de um
-- líder dele.
create or replace function tlp_presenca.visao_coordenacao_perfil(p_perfil_id uuid)
returns boolean
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select
    tlp_presenca.sou_admin()
    or tlp_presenca.sou_auditor()
    or (
      tlp_presenca.sou_coordenador()
      and (
        tlp_presenca.sou_coordenador_do_lider(p_perfil_id)
        or exists (
          select 1
          from tlp_presenca.colaboradores c
          join tlp_presenca.perfis l on l.id = c.lider_id
          where c.perfil_id = p_perfil_id and l.coordenador_id = auth.uid()
        )
      )
    );
$$;

-- ---------------------------------------------------------
-- Troca as policies de SELECT que usavam visao_global() pelas novas
-- funções escopadas, nas tabelas onde isso importa pro isolamento entre
-- coordenadores.
-- ---------------------------------------------------------

drop policy if exists "colaboradores_select_coordenador" on tlp_presenca.colaboradores;
create policy "colaboradores_select_coordenador"
  on tlp_presenca.colaboradores for select
  to authenticated
  using (tlp_presenca.visao_coordenacao_colaborador(id));

drop policy if exists "perfis_select_coordenador" on tlp_presenca.perfis;
create policy "perfis_select_coordenador"
  on tlp_presenca.perfis for select
  to authenticated
  using (tlp_presenca.visao_coordenacao_perfil(id));

drop policy if exists "registros_select_coordenador" on tlp_presenca.registros_presenca;
create policy "registros_select_coordenador"
  on tlp_presenca.registros_presenca for select
  to authenticated
  using (tlp_presenca.visao_coordenacao_colaborador(colaborador_id));

drop policy if exists "justificativas_select_coordenador" on tlp_presenca.justificativas;
create policy "justificativas_select_coordenador"
  on tlp_presenca.justificativas for select
  to authenticated
  using (tlp_presenca.visao_coordenacao_colaborador(colaborador_id));

drop policy if exists "status_dia_select_visao_global" on tlp_presenca.status_dia;
create policy "status_dia_select_coordenador"
  on tlp_presenca.status_dia for select
  to authenticated
  using (tlp_presenca.visao_coordenacao_colaborador(colaborador_id));

drop policy if exists "fotos_presenca_select_visao_global" on storage.objects;
create policy "fotos_presenca_select_coordenador"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'tlp-fotos-presenca'
    and tlp_presenca.visao_coordenacao_colaborador((storage.foldername(name))[2]::uuid)
  );

drop policy if exists "justificativas_bucket_select_visao_global" on storage.objects;
create policy "justificativas_bucket_select_coordenador"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'tlp-justificativas'
    and tlp_presenca.visao_coordenacao_colaborador((storage.foldername(name))[2]::uuid)
  );

-- ---------------------------------------------------------
-- transicionar_status_dia (a função por trás de aprovar/rejeitar/marcar
-- status manual — chamada pelo StatusActionMenu) ainda liberava qualquer
-- coordenador pra decidir o status de QUALQUER colaborador via
-- pode_decidir_presenca() (= admin ou coordenador, sem escopo nenhum).
-- Troca esse braço pela checagem escopada — sem isso, restringir a
-- listagem (acima) não impediria a ação em si via chamada direta à função.
-- ---------------------------------------------------------
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
    or tlp_presenca.sou_lider_do_colaborador(v_atual.colaborador_id)
    or (tlp_presenca.sou_coordenador() and tlp_presenca.sou_coordenador_do_colaborador(v_atual.colaborador_id))
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

-- ---------------------------------------------------------
-- Criar colaborador: coordenador só pode atribuir a um líder que ele
-- mesmo coordena (antes, pode_decidir_presenca() liberava qualquer
-- lider_id pra qualquer coordenador).
-- ---------------------------------------------------------
drop policy if exists "colaboradores_insert_lider_direto" on tlp_presenca.colaboradores;
create policy "colaboradores_insert_lider_direto"
  on tlp_presenca.colaboradores for insert
  to authenticated
  with check (
    lider_id = auth.uid()
    or tlp_presenca.sou_admin()
    or tlp_presenca.sou_coordenador_do_lider(lider_id)
  );
