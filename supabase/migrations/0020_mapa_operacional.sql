-- =========================================================
-- 0020 · Módulo 9 — Mapa operacional (preparação de dados)
--
-- 1) precisao_metros: hoje a precisão do GPS era jogada dentro do texto de
--    "observacao" (ver Edge Function checkin-publico) — vira coluna própria,
--    numérica, para poder ser exibida/filtrada no mapa.
-- 2) marcar_status_dia_pendente: conecta o check-in público (Edge Function,
--    que roda com service_role e não tem auth.uid()) ao status_dia do
--    Módulo 6 — sem isso, o check-in gravava em registros_presenca mas o
--    status_dia do colaborador nunca saía de FALTA/FOLGA.
-- 3) vw_mapa_operacional: uma linha por colaborador ativo/dia, já com
--    status_dia + localização/precisão do registro vinculado (se houver).
-- =========================================================

alter table tlp_presenca.registros_presenca add column precisao_metros double precision;
comment on column tlp_presenca.registros_presenca.precisao_metros is 'Precisão do GPS em metros, informada pelo dispositivo (navigator.geolocation).';

-- ---------------------------------------------------------
-- Chamada pela Edge Function checkin-publico (service_role) após gravar o
-- registro de presença: garante a linha do dia e move para PENDENTE.
-- Não faz a checagem de auth.uid() de transicionar_status_dia porque quem
-- chama é sempre a service_role (sem sessão de usuário) — a superfície de
-- ataque é a mesma da Edge Function em si (endpoint público, ver 0016/CHECKLIST).
-- ---------------------------------------------------------
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
    -- já foi decidido manualmente hoje (ex.: líder marcou ATESTADO antes do check-in) — não sobrescreve
    return v_status_dia;
  end if;

  update tlp_presenca.status_dia
  set status = 'PENDENTE',
      registro_presenca_id = p_registro_presenca_id
  where id = v_status_dia.id
  returning * into v_status_dia;

  return v_status_dia;
end;
$$;

comment on function tlp_presenca.marcar_status_dia_pendente(uuid, uuid) is
  'Usada pela Edge Function checkin-publico para mover o status do dia para PENDENTE ao receber uma marcação do técnico.';

-- ---------------------------------------------------------
-- View para o mapa operacional: uma linha por status_dia de hoje (ou de
-- qualquer data consultada), com a última localização/precisão conhecida.
-- ---------------------------------------------------------
create or replace view tlp_presenca.vw_mapa_operacional as
select
  sd.id as status_dia_id,
  sd.colaborador_id,
  sd.filial_id,
  sd.data_referencia,
  sd.status,
  c.nome as colaborador_nome,
  c.matricula as colaborador_matricula,
  f.nome as filial_nome,
  rp.latitude,
  rp.longitude,
  rp.precisao_metros,
  rp.horario_registrado
from tlp_presenca.status_dia sd
join tlp_presenca.colaboradores c on c.id = sd.colaborador_id
join tlp_presenca.filiais f on f.id = sd.filial_id
left join tlp_presenca.registros_presenca rp on rp.id = sd.registro_presenca_id;

comment on view tlp_presenca.vw_mapa_operacional is
  'Uma linha por status_dia com a localização/precisão do registro de presença vinculado (se houver). Base do mapa operacional (Módulo 9).';

alter view tlp_presenca.vw_mapa_operacional set (security_invoker = true);

-- ---------------------------------------------------------
-- gestor_filiais precisava de leitura global para coordenador/auditor
-- (usado pelo filtro "por líder" do mapa operacional) — a policy da 0011
-- ("gestor_filiais_all_coordenador") ficou restrita a admin depois que
-- pode_gerenciar_usuarios() passou a valer só para admin (migration 0015).
-- ---------------------------------------------------------
create policy "gestor_filiais_select_visao_global"
  on tlp_presenca.gestor_filiais for select
  to authenticated
  using (tlp_presenca.visao_global());
