-- =========================================================
-- 0073 · Auditoria de troca de líder de colaborador (individual ou em lote)
--
-- Pedido: "líder secundário" pra quando o líder principal sai de férias e a
-- equipe é emprestada pra outro — decidido que a troca é manual (reatribuir
-- lider_id e reverter depois manualmente, sem período automático). Duas
-- pontas usam esse mesmo UPDATE simples: a troca individual que já existia
-- (TrocarLiderColaborador) e a nova troca em lote (ReatribuirEquipeLote).
-- Nenhuma das duas era auditada até agora — um trigger genérico cobre as
-- duas de uma vez, sem precisar de RPC dedicada (a RLS de 0036/0028 já
-- restringe quem pode fazer o UPDATE).
-- =========================================================

create or replace function tlp_presenca.registrar_auditoria_troca_lider_colaborador()
returns trigger
language plpgsql
security definer
set search_path = tlp_presenca
as $$
begin
  if new.lider_id is distinct from old.lider_id then
    insert into tlp_presenca.audit_log (ator_id, acao, entidade, entidade_id, detalhes)
    values (
      auth.uid(),
      'colaborador_lider_alterado',
      'colaboradores',
      new.id,
      jsonb_build_object('lider_de', old.lider_id, 'lider_para', new.lider_id)
    );
  end if;
  return new;
end;
$$;

create trigger trg_audit_troca_lider_colaborador
  after update of lider_id on tlp_presenca.colaboradores
  for each row execute function tlp_presenca.registrar_auditoria_troca_lider_colaborador();
