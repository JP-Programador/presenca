-- =========================================================
-- 0019 · Leitura global de status_dia para coordenador/auditor
--
-- Mesmo padrão das migrations 0011/0015: policy ADICIONAL (permissivas se
-- combinam com OR), dando visão global a quem tem visao_global() = true
-- (admin, auditor, coordenador) sem alterar a policy de gestor da 0018.
-- =========================================================

create policy "status_dia_select_visao_global"
  on tlp_presenca.status_dia for select
  to authenticated
  using (tlp_presenca.visao_global());

-- Escrita direta (fora da RPC transicionar_status_dia) também para quem
-- pode decidir presença (admin/coordenador — não auditor).
create policy "status_dia_update_coordenador"
  on tlp_presenca.status_dia for update
  to authenticated
  using (tlp_presenca.pode_decidir_presenca())
  with check (tlp_presenca.pode_decidir_presenca());
