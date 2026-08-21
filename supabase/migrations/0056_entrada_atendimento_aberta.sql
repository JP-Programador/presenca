-- =========================================================
-- 0056 · Função auxiliar: devolve a entrada aberta (se houver)
--
-- Complementa proximo_tipo_marcacao (0055) — quando a próxima marcação é
-- "saida", o checkin-publico precisa do id da entrada aberta pra vincular
-- (registro_presenca_entrada_id). Evita duplicar a mesma consulta
-- anti-join em TypeScript.
-- =========================================================

create or replace function tlp_presenca.entrada_atendimento_aberta(p_colaborador_id uuid)
returns tlp_presenca.registros_presenca
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select rp.*
  from tlp_presenca.registros_presenca rp
  where rp.colaborador_id = p_colaborador_id
    and rp.tipo = 'entrada'
    and not exists (
      select 1 from tlp_presenca.marcacoes_atendimento ma
      where ma.registro_presenca_entrada_id = rp.id
    )
  order by rp.horario_registrado desc
  limit 1;
$$;

comment on function tlp_presenca.entrada_atendimento_aberta(uuid) is
  'Entrada (registros_presenca) mais recente do colaborador sem saída vinculada ainda — null se não houver nenhuma aberta.';
