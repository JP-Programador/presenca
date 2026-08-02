-- =========================================================
-- 0028 · Hierarquia direta (líder/coordenador) + senha inicial fixa
--
-- - colaboradores.lider_id: o líder direto de cada colaborador. Passa a ser
--   o mecanismo real de visibilidade do líder (ele só vê quem está
--   diretamente abaixo dele — não mais "todo mundo da filial").
-- - perfis.coordenador_id: o coordenador direto de cada líder (informativo
--   + usado pra líder criado por um coordenador já nascer vinculado a ele).
-- - perfis.senha_temporaria: novo usuário nasce com a senha fixa "Mudar@123"
--   e essa flag true — o frontend obriga a troca antes de liberar qualquer
--   tela (ver TrocarSenhaObrigatoria.tsx).
-- =========================================================

alter table tlp_presenca.colaboradores add column lider_id uuid references tlp_presenca.perfis(id) on delete set null;
comment on column tlp_presenca.colaboradores.lider_id is 'Líder direto do colaborador — base da visibilidade do líder (só vê quem está diretamente abaixo dele).';

alter table tlp_presenca.perfis add column coordenador_id uuid references tlp_presenca.perfis(id) on delete set null;
comment on column tlp_presenca.perfis.coordenador_id is 'Coordenador direto de um líder (perfil=gestor). Informativo + preenchido automaticamente quando o coordenador cria o líder.';

alter table tlp_presenca.perfis add column senha_temporaria boolean not null default false;
comment on column tlp_presenca.perfis.senha_temporaria is 'true = usuário ainda está com a senha inicial fixa e precisa trocá-la antes de usar o sistema.';

create index colaboradores_lider_id_idx on tlp_presenca.colaboradores (lider_id);
create index perfis_coordenador_id_idx on tlp_presenca.perfis (coordenador_id);

-- ---------------------------------------------------------
-- Visibilidade direta do líder: true se o colaborador informado tem
-- lider_id = usuário autenticado atual. Usada como alternativa (OR) a
-- gerencio_filial() nas tabelas ligadas a colaborador_id — não substitui
-- gerencio_filial (mantém compatibilidade com atribuições antigas via
-- gestor_filiais), só amplia para o novo modelo de hierarquia direta.
-- ---------------------------------------------------------
create or replace function tlp_presenca.sou_lider_do_colaborador(p_colaborador_id uuid)
returns boolean
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select exists (
    select 1 from tlp_presenca.colaboradores c
    where c.id = p_colaborador_id and c.lider_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------
-- colaboradores: líder vê/edita quem está diretamente abaixo dele, mesmo
-- sem entrada em gestor_filiais (a política antiga via gerencio_filial
-- continua valendo em paralelo, para não quebrar atribuições existentes).
-- ---------------------------------------------------------
create policy "colaboradores_select_lider_direto"
  on tlp_presenca.colaboradores for select
  to authenticated
  using (lider_id = auth.uid());

create policy "colaboradores_insert_lider_direto"
  on tlp_presenca.colaboradores for insert
  to authenticated
  with check (lider_id = auth.uid() or tlp_presenca.pode_decidir_presenca());

create policy "colaboradores_update_lider_direto"
  on tlp_presenca.colaboradores for update
  to authenticated
  using (lider_id = auth.uid())
  with check (lider_id = auth.uid());

-- ---------------------------------------------------------
-- status_dia / registros_presenca / justificativas / marcacoes_dia:
-- mesma lógica, via join com colaboradores.lider_id.
-- ---------------------------------------------------------
create policy "status_dia_select_lider_direto"
  on tlp_presenca.status_dia for select
  to authenticated
  using (tlp_presenca.sou_lider_do_colaborador(colaborador_id));

create policy "status_dia_update_lider_direto"
  on tlp_presenca.status_dia for update
  to authenticated
  using (tlp_presenca.sou_lider_do_colaborador(colaborador_id))
  with check (tlp_presenca.sou_lider_do_colaborador(colaborador_id));

create policy "registros_select_lider_direto"
  on tlp_presenca.registros_presenca for select
  to authenticated
  using (tlp_presenca.sou_lider_do_colaborador(colaborador_id));

create policy "registros_update_lider_direto"
  on tlp_presenca.registros_presenca for update
  to authenticated
  using (tlp_presenca.sou_lider_do_colaborador(colaborador_id))
  with check (tlp_presenca.sou_lider_do_colaborador(colaborador_id));

create policy "justificativas_select_lider_direto"
  on tlp_presenca.justificativas for select
  to authenticated
  using (tlp_presenca.sou_lider_do_colaborador(colaborador_id));

create policy "justificativas_update_lider_direto"
  on tlp_presenca.justificativas for update
  to authenticated
  using (tlp_presenca.sou_lider_do_colaborador(colaborador_id))
  with check (tlp_presenca.sou_lider_do_colaborador(colaborador_id));

create policy "marcacoes_dia_select_lider_direto"
  on tlp_presenca.marcacoes_dia for select
  to authenticated
  using (tlp_presenca.sou_lider_do_colaborador(colaborador_id));

-- transicionar_status_dia (0018/0021/0025) já aceita gerencio_filial() OU
-- pode_decidir_presenca() — adiciona também a checagem de líder direto,
-- senão um líder sem entrada em gestor_filiais não consegue aprovar/rejeitar
-- a presença dos próprios liderados.
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
    or tlp_presenca.sou_lider_do_colaborador(v_atual.colaborador_id)
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

grant all on all tables in schema tlp_presenca to anon, authenticated, service_role;
grant all on all functions in schema tlp_presenca to anon, authenticated, service_role;
