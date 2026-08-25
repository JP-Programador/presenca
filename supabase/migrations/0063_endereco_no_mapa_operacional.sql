-- =========================================================
-- 0063 · Adiciona endereço (geocodificação reversa) na view do mapa
-- operacional — usado pra trocar o nome da filial pelo endereço no popup
-- do mapa (o nome da filial/"equipe" saiu do popup, pedido do usuário).
-- =========================================================

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
  rp.horario_registrado,
  rp.endereco_completo
from tlp_presenca.status_dia sd
join tlp_presenca.colaboradores c on c.id = sd.colaborador_id
join tlp_presenca.filiais f on f.id = sd.filial_id
left join tlp_presenca.registros_presenca rp on rp.id = sd.registro_presenca_id;

comment on view tlp_presenca.vw_mapa_operacional is
  'Uma linha por status_dia com a localização/precisão/endereço do registro de presença vinculado (se houver). Base do mapa operacional (Módulo 9).';

alter view tlp_presenca.vw_mapa_operacional set (security_invoker = true);
