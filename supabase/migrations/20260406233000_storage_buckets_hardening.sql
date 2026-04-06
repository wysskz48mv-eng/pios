-- Align storage bucket configuration with the production upload contract.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'pios-files',
    'pios-files',
    false,
    26214400,
    array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'application/json'
    ]::text[]
  ),
  (
    'pios-cv',
    'pios-cv',
    false,
    10485760,
    array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ]::text[]
  )
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "pios_files_owner_upload" on storage.objects;
drop policy if exists "pios_files_owner_read" on storage.objects;
drop policy if exists "pios_files_owner_delete" on storage.objects;
drop policy if exists "pios_cv_owner_upload" on storage.objects;
drop policy if exists "pios_cv_owner_read" on storage.objects;
drop policy if exists "pios_cv_owner_delete" on storage.objects;

create policy "pios_files_owner_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'pios-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "pios_files_owner_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'pios-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "pios_files_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'pios-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "pios_cv_owner_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'pios-cv'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "pios_cv_owner_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'pios-cv'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "pios_cv_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'pios-cv'
    and auth.uid()::text = (storage.foldername(name))[1]
  );