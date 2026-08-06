-- =========================================================
-- 0036 · Coordenador pode atualizar (inativar/reativar, trocar líder)
-- colaboradores que estão sob os líderes que ele coordena
--
-- Contexto: "colaboradores_update" (0005) só cobre admin/gerencio_filial
-- (modelo antigo de gestor_filiais) e "colaboradores_update_lider_direto"
-- (0028) só cobre o próprio líder direto. Coordenador nunca ganhou uma
-- policy de UPDATE em colaboradores — só SELECT (0011) — então as ações
-- de excluir/reativar/trocar líder feitas pelo coordenador na tela
-- /colaboradores estavam sendo bloqueadas silenciosamente pelo RLS.
-- =========================================================

create policy "colaboradores_update_coordenador"
  on tlp_presenca.colaboradores for update
  to authenticated
  using (
    tlp_presenca.sou_coordenador()
    and exists (
      select 1 from tlp_presenca.perfis lider
      where lider.id = lider_id
        and lider.coordenador_id = auth.uid()
    )
  )
  with check (
    tlp_presenca.sou_coordenador()
    and exists (
      select 1 from tlp_presenca.perfis lider
      where lider.id = lider_id
        and lider.coordenador_id = auth.uid()
    )
  );
