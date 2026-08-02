-- =========================================================
-- 0016 · Corrige policy de update de "perfis" (revisão de segurança)
--
-- Problema: "perfis_update_proprio_ou_admin" (migration 0005) só travava
-- a coluna "perfil" no with check. Um usuário autenticado podia, via
-- chamada direta ao Supabase, reativar a própria conta (ativo = true)
-- ou mudar a própria filial_id, mesmo após um admin desativá-lo.
--
-- Correção: usuário comum só pode alterar "nome"; perfil, ativo e
-- filial_id continuam travados nos valores atuais salvo para admin.
-- =========================================================

drop policy if exists "perfis_update_proprio_ou_admin" on tlp_presenca.perfis;

create policy "perfis_update_proprio_ou_admin"
  on tlp_presenca.perfis for update
  to authenticated
  using (id = auth.uid() or tlp_presenca.sou_admin())
  with check (
    tlp_presenca.sou_admin()
    or (
      id = auth.uid()
      and perfil = (select perfil from tlp_presenca.perfis where id = auth.uid())
      and ativo = (select ativo from tlp_presenca.perfis where id = auth.uid())
      and filial_id is not distinct from (select filial_id from tlp_presenca.perfis where id = auth.uid())
    )
  ); -- usuário comum só edita o próprio nome; perfil/ativo/filial_id travados salvo para admin
