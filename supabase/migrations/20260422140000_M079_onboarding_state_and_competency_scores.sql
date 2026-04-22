begin;

-- ============================================================
-- M079: Onboarding state machine + 23-dimensional competency scores
-- Date: 2026-04-22
-- ============================================================

-- 1) User-level onboarding completion parity fields
alter table if exists public.user_profiles
  add column if not exists onboarding_complete boolean not null default false,
  add column if not exists onboarding_current_step integer not null default 1,
  add column if not exists onboarding_completed_at timestamptz;

alter table if exists public.user_profiles
  drop constraint if exists onboarding_current_step_check;

alter table if exists public.user_profiles
  add constraint onboarding_current_step_check
  check (onboarding_current_step between 1 and 6);

update public.user_profiles
set onboarding_complete = coalesce(onboarded, false)
where onboarding_complete is distinct from coalesce(onboarded, false);

update public.user_profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, updated_at, now())
where onboarding_complete = true
  and onboarding_completed_at is null;

-- 2) Explicit onboarding state tracking table
create table if not exists public.onboarding_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_step integer not null default 1,
  step_history jsonb not null default '[]'::jsonb,
  persona_selected text,
  calibration_answers jsonb not null default '{}'::jsonb,
  cv_uploaded boolean not null default false,
  cv_analyzed boolean not null default false,
  cv_skipped boolean not null default false,
  onboarding_complete boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_state_step_check check (current_step between 1 and 6)
);

create index if not exists idx_onboarding_state_current_step on public.onboarding_state(current_step);
create index if not exists idx_onboarding_state_updated_at on public.onboarding_state(updated_at desc);

alter table public.onboarding_state enable row level security;

drop policy if exists onboarding_state_own on public.onboarding_state;
create policy onboarding_state_own
  on public.onboarding_state
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 3) 23-dim calibration support in nemoclaw_calibration
alter table if exists public.nemoclaw_calibration
  add column if not exists competency_scores jsonb not null default '{}'::jsonb,
  add column if not exists competency_confidence jsonb not null default '{}'::jsonb,
  add column if not exists top_competencies jsonb not null default '[]'::jsonb,
  add column if not exists cv_profile_summary text,
  add column if not exists calibrated_via text not null default 'cv';

-- 4) Keep user_profiles and onboarding_state in sync
create or replace function public.sync_onboarding_state_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_profiles
  set
    onboarding_complete = new.onboarding_complete,
    onboarded = new.onboarding_complete,
    onboarding_current_step = new.current_step,
    onboarding_completed_at = case
      when new.onboarding_complete then coalesce(new.completed_at, now())
      else null
    end,
    updated_at = now()
  where id = new.user_id;

  return new;
end;
$$;

drop trigger if exists trg_sync_onboarding_state_to_profile on public.onboarding_state;
create trigger trg_sync_onboarding_state_to_profile
after insert or update on public.onboarding_state
for each row execute function public.sync_onboarding_state_to_profile();

-- 5) Backfill onboarding_state from current profile records
insert into public.onboarding_state (
  user_id,
  current_step,
  step_history,
  persona_selected,
  cv_uploaded,
  cv_analyzed,
  cv_skipped,
  onboarding_complete,
  started_at,
  completed_at,
  last_seen_at,
  created_at,
  updated_at
)
select
  up.id,
  case
    when coalesce(up.onboarding_complete, up.onboarded, false) then 6
    when coalesce(up.persona_type, '') <> '' then 3
    else 1
  end as current_step,
  '[]'::jsonb,
  nullif(up.persona_type, ''),
  (up.cv_storage_path is not null),
  (up.cv_processing_status in ('complete', 'completed')),
  false,
  coalesce(up.onboarding_complete, up.onboarded, false),
  coalesce(up.created_at, now()),
  case when coalesce(up.onboarding_complete, up.onboarded, false)
    then coalesce(up.onboarding_completed_at, up.updated_at, now())
    else null end,
  now(),
  coalesce(up.created_at, now()),
  now()
from public.user_profiles up
on conflict (user_id) do update
set current_step = excluded.current_step,
    persona_selected = coalesce(public.onboarding_state.persona_selected, excluded.persona_selected),
    cv_uploaded = public.onboarding_state.cv_uploaded or excluded.cv_uploaded,
    cv_analyzed = public.onboarding_state.cv_analyzed or excluded.cv_analyzed,
    onboarding_complete = public.onboarding_state.onboarding_complete or excluded.onboarding_complete,
    completed_at = coalesce(public.onboarding_state.completed_at, excluded.completed_at),
    last_seen_at = now(),
    updated_at = now();

commit;
