-- M116 — storage bucket for rendered proposal artifacts (docx/pdf/pptx/xlsx).
-- Private bucket, user-scoped RLS (top-level folder must match auth.uid()).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proposal-outputs',
  'proposal-outputs',
  false,
  52428800, -- 50 MB per object
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/markdown',
    'text/html'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "proposal_outputs_read_own" on storage.objects;
create policy "proposal_outputs_read_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'proposal-outputs'
  and (storage.foldername(name))[1] = auth.uid()::text
);
