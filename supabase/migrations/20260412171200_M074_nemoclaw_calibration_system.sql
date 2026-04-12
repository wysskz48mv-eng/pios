begin;

alter table public.user_profiles
  add column if not exists nemoclaw_calibrated boolean not null default false,
  add column if not exists nemoclaw_calibrated_at timestamptz;

update public.user_profiles
set nemoclaw_calibrated = true,
    nemoclaw_calibrated_at = coalesce(nemoclaw_calibrated_at, cv_uploaded_at, now()),
    updated_at = now()
where (cv_processing_status in ('complete', 'completed'))
  and nemoclaw_calibrated = false;

create table if not exists public.nemoclaw_calibration (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  cv_storage_path text,
  cv_filename text,
  extracted_data jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.nemoclaw_calibration
  add column if not exists status text not null default 'pending',
  add column if not exists cv_storage_path text,
  add column if not exists cv_filename text,
  add column if not exists extracted_data jsonb not null default '{}'::jsonb,
  add column if not exists processed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'nemoclaw_calibration_status_check'
  ) then
    alter table public.nemoclaw_calibration
      add constraint nemoclaw_calibration_status_check
      check (status in ('pending', 'processing', 'completed', 'failed'));
  end if;
end $$;

alter table public.nemoclaw_calibration enable row level security;

drop policy if exists nemoclaw_calibration_own on public.nemoclaw_calibration;
create policy nemoclaw_calibration_own
  on public.nemoclaw_calibration
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_nemoclaw_calibration_status on public.nemoclaw_calibration(status);

create or replace function public.rollback_nemoclaw_calibration_migration()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  alter table public.user_profiles
    drop column if exists nemoclaw_calibrated,
    drop column if exists nemoclaw_calibrated_at;

  return 'rollback_nemoclaw_calibration_migration complete';
end;
$$;

commit;
