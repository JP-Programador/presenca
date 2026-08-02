-- =========================================================
-- 0006 · Storage — bucket de fotos de presença
--
-- Convenção de path: {filial_id}/{colaborador_id}/{registro_id}.jpg
-- Essa convenção é o que permite às policies abaixo checar
-- permissão sem precisar de uma tabela extra de metadados.
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tlp-fotos-presenca',
  'tlp-fotos-presenca',
  false,                          -- bucket privado; acesso via signed URL ou policy
  5242880,                        -- 5MB por foto
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Bucket separado para anexos de justificativa (atestados etc.), também privado
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tlp-justificativas',
  'tlp-justificativas',
  false,
  10485760,                       -- 10MB
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------
-- Policies do bucket fotos-presenca
-- storage.objects.name = '{filial_id}/{colaborador_id}/{arquivo}'
-- ---------------------------------------------------------

create policy "fotos_presenca_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'tlp-fotos-presenca'
    and (
      tlp_presenca.sou_admin()
      or tlp_presenca.gerencio_filial((storage.foldername(name))[1]::uuid)
      or (storage.foldername(name))[2]::uuid = tlp_presenca.meu_colaborador_id()
    )
  );

create policy "fotos_presenca_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'tlp-fotos-presenca'
    and (
      tlp_presenca.sou_admin()
      or tlp_presenca.gerencio_filial((storage.foldername(name))[1]::uuid)
      or (storage.foldername(name))[2]::uuid = tlp_presenca.meu_colaborador_id()
    )
  );

-- Delete manual restrito a gestor/admin (a exclusão automática das 48h roda
-- via Edge Function com a service_role key, que não é afetada por RLS).
create policy "fotos_presenca_delete_gestor"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'tlp-fotos-presenca'
    and (
      tlp_presenca.sou_admin()
      or tlp_presenca.gerencio_filial((storage.foldername(name))[1]::uuid)
    )
  );

-- ---------------------------------------------------------
-- Policies do bucket justificativas
-- storage.objects.name = '{filial_id}/{colaborador_id}/{arquivo}'
-- ---------------------------------------------------------

create policy "justificativas_bucket_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'tlp-justificativas'
    and (
      tlp_presenca.sou_admin()
      or tlp_presenca.gerencio_filial((storage.foldername(name))[1]::uuid)
      or (storage.foldername(name))[2]::uuid = tlp_presenca.meu_colaborador_id()
    )
  );

create policy "justificativas_bucket_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'tlp-justificativas'
    and (
      tlp_presenca.sou_admin()
      or (storage.foldername(name))[2]::uuid = tlp_presenca.meu_colaborador_id()
      or tlp_presenca.gerencio_filial((storage.foldername(name))[1]::uuid)
    )
  );

create policy "justificativas_bucket_delete_gestor"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'tlp-justificativas'
    and (
      tlp_presenca.sou_admin()
      or tlp_presenca.gerencio_filial((storage.foldername(name))[1]::uuid)
    )
  );
