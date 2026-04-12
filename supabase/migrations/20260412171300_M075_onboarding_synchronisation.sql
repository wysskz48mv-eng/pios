begin;

create table if not exists public.user_personas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  primary_persona text not null default 'executive',
  secondary_persona text,
  tier text not null default 'standard',
  nemoclaw_activated boolean not null default false,
  nemoclaw_activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_personas_primary_check check (primary_persona in ('CEO', 'CONSULTANT', 'ACADEMIC', 'CHIEF_OF_STAFF', 'EXECUTIVE', 'WHOLE_LIFE', 'executive', 'consultant', 'academic'))
);

create table if not exists public.onboarding_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  completed_steps jsonb not null default '{}'::jsonb,
  readiness_pct numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_progress_readiness_check check (readiness_pct >= 0 and readiness_pct <= 100)
);

alter table public.user_personas enable row level security;
alter table public.onboarding_progress enable row level security;

drop policy if exists user_personas_own on public.user_personas;
create policy user_personas_own
  on public.user_personas
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists onboarding_progress_own on public.onboarding_progress;
create policy onboarding_progress_own
  on public.onboarding_progress
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

insert into public.user_personas (user_id, primary_persona, secondary_persona, tier, created_at, updated_at)
select
  up.id as user_id,
  case up.persona_type
    when 'executive' then 'CEO'
    when 'consultant' then 'CONSULTANT'
    when 'academic' then 'ACADEMIC'
    else 'EXECUTIVE'
  end as primary_persona,
  case when up.persona_type = 'executive' then 'CHIEF_OF_STAFF' else null end as secondary_persona,
  'standard' as tier,
  now(),
  now()
from public.user_profiles up
on conflict (user_id) do update
set primary_persona = excluded.primary_persona,
    secondary_persona = excluded.secondary_persona,
    updated_at = now();

insert into public.onboarding_progress (user_id, completed_steps, readiness_pct, created_at, updated_at)
select
  up.id,
  jsonb_strip_nulls(jsonb_build_object(
    'profile', (coalesce(up.full_name, '') <> '' and coalesce(up.organisation, '') <> ''),
    'nemoclaw', (coalesce(up.nemoclaw_calibrated, false) or up.cv_processing_status in ('complete', 'completed')),
    'google_oauth', (coalesce(up.google_email, '') <> '')
  )),
  (
    (case when coalesce(up.full_name, '') <> '' and coalesce(up.organisation, '') <> '' then 1 else 0 end) +
    (case when coalesce(up.nemoclaw_calibrated, false) or up.cv_processing_status in ('complete', 'completed') then 1 else 0 end) +
    (case when coalesce(up.google_email, '') <> '' then 1 else 0 end)
  )::numeric / 3 * 100,
  now(),
  now()
from public.user_profiles up
on conflict (user_id) do update
set completed_steps = excluded.completed_steps,
    readiness_pct = excluded.readiness_pct,
    updated_at = now();

create or replace function public.rollback_onboarding_sync_migration()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  drop table if exists public.onboarding_progress;
  drop table if exists public.user_personas;
  return 'rollback_onboarding_sync_migration complete';
end;
$$;

commit;
