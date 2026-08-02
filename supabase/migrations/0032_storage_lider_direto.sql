-- =========================================================
-- 0032 · Storage (fotos) reconhece o líder direto
--
-- As policies de storage.objects (migration 0006) só liberavam acesso via
-- gerencio_filial() (atribuição em gestor_filiais). Desde a hierarquia
-- direta (migration 0028), um líder pode não ter entrada em gestor_filiais
-- e mesmo assim precisa ver a foto dos colaboradores que lidera — path é
-- {filial_id}/{colaborador_id}/{arquivo}, então usamos o segmento 2 do
-- caminho (colaborador_id) com a mesma função sou_lider_do_colaborador().
-- =========================================================

create policy "fotos_presenca_select_lider_direto"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'tlp-fotos-presenca'
    and tlp_presenca.sou_lider_do_colaborador((storage.foldername(name))[2]::uuid)
  );

create policy "justificativas_bucket_select_lider_direto"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'tlp-justificativas'
    and tlp_presenca.sou_lider_do_colaborador((storage.foldername(name))[2]::uuid)
  );

-- ---------------------------------------------------------
-- Leitura global (coordenador/auditor) também faltava nas fotos — hoje só
-- admin/gestor viam. auditor/coordenador precisam ver a foto pra revisar
-- pendências e auditoria.
-- ---------------------------------------------------------
create policy "fotos_presenca_select_visao_global"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'tlp-fotos-presenca' and tlp_presenca.visao_global());

create policy "justificativas_bucket_select_visao_global"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'tlp-justificativas' and tlp_presenca.visao_global());
