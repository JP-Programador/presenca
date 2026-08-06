-- =========================================================
-- 0035 · Coordenador volta a poder editar/ativar/desativar usuários,
-- mas só dentro da própria hierarquia direta (não qualquer usuário)
--
-- Contexto: a 0015 restringiu update/insert em "perfis" a admin apenas
-- ("Gestão de usuários... agora é EXCLUSIVA do admin"). Na prática isso
-- impedia o coordenador de desativar/reatribuir papel até dos próprios
-- líderes e colaboradores, o que quebrou o fluxo esperado na tela
-- /usuarios. Reintroduz o acesso, mas escopado: coordenador só pode
-- alterar (a) líderes (perfil=gestor) que ele mesmo criou
-- (perfis.coordenador_id = auth.uid()) e (b) colaboradores com login
-- próprio (perfil=colaborador) cujo colaborador.lider_id aponta pra um
-- desses líderes. Segue o mesmo modelo de "líder direto" da 0028.
-- =========================================================

create or replace function tlp_presenca.pode_gerenciar_usuario_alvo(p_perfil_id uuid)
returns boolean
language sql
stable
security definer
set search_path = tlp_presenca
as $$
  select
    tlp_presenca.sou_admin()
    or (
      tlp_presenca.sou_coordenador()
      and exists (
        select 1
        from tlp_presenca.perfis alvo
        where alvo.id = p_perfil_id
          and (
            (alvo.perfil = 'gestor' and alvo.coordenador_id = auth.uid())
            or (
              alvo.perfil = 'colaborador'
              and exists (
                select 1
                from tlp_presenca.colaboradores c
                join tlp_presenca.perfis lider on lider.id = c.lider_id
                where c.perfil_id = alvo.id
                  and lider.coordenador_id = auth.uid()
              )
            )
          )
      )
    );
$$;

comment on function tlp_presenca.pode_gerenciar_usuario_alvo(uuid) is
  'true se o usuário atual pode editar papel/ativo do perfil-alvo: admin sempre; coordenador só para líderes que ele criou e colaboradores desses líderes.';

drop policy if exists "perfis_update_coordenador" on tlp_presenca.perfis;

create policy "perfis_update_coordenador"
  on tlp_presenca.perfis for update
  to authenticated
  using (tlp_presenca.pode_gerenciar_usuario_alvo(id))
  with check (tlp_presenca.pode_gerenciar_usuario_alvo(id));
