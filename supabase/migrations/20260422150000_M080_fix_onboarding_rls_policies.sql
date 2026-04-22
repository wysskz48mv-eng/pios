begin;

-- ============================================================
-- M080: Harden onboarding persistence + RLS safety net
-- Date: 2026-04-22
-- Purpose: Unblock onboarding state writes in environments with
--          partial migration application or restrictive RLS.
-- ============================================================

-- 1) Ensure user_profiles has onboarding parity columns
alter table if exists public.user_profiles
  add column if not exists onboarding_complete boolean not null default false,
  add column if not exists onboarding_current_step integer not null default 1,
  add column if not exists onboarding_completed_at timestamptz;

alter table if exists public.user_profiles
  drop constraint if exists onboarding_current_step_check;

alter table if exists public.user_profiles
  add constraint onboarding_current_step_check
  check (onboarding_current_step between 1 and 6);

-- 2) Ensure onboarding_state exists even if M079 was not yet applied
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

drop policy if exists onboarding_state_select_own on public.onboarding_state;
create policy onboarding_state_select_own
  on public.onboarding_state
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists onboarding_state_insert_own on public.onboarding_state;
create policy onboarding_state_insert_own
  on public.onboarding_state
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists onboarding_state_update_own on public.onboarding_state;
create policy onboarding_state_update_own
  on public.onboarding_state
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists onboarding_state_delete_own on public.onboarding_state;
create policy onboarding_state_delete_own
  on public.onboarding_state
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Keep compatibility with prior single-policy variant
drop policy if exists onboarding_state_own on public.onboarding_state;

-- 3) Ensure nemoclaw_calibration has M079 competency columns
alter table if exists public.nemoclaw_calibration
  add column if not exists competency_scores jsonb not null default '{}'::jsonb,
  add column if not exists competency_confidence jsonb not null default '{}'::jsonb,
  add column if not exists top_competencies jsonb not null default '[]'::jsonb,
  add column if not exists cv_profile_summary text,
  add column if not exists calibrated_via text not null default 'cv';

alter table if exists public.nemoclaw_calibration enable row level security;

drop policy if exists nemoclaw_calibration_select_own on public.nemoclaw_calibration;
create policy nemoclaw_calibration_select_own
  on public.nemoclaw_calibration
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists nemoclaw_calibration_insert_own on public.nemoclaw_calibration;
create policy nemoclaw_calibration_insert_own
  on public.nemoclaw_calibration
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists nemoclaw_calibration_update_own on public.nemoclaw_calibration;
create policy nemoclaw_calibration_update_own
  on public.nemoclaw_calibration
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep compatibility with prior single-policy variant
drop policy if exists nemoclaw_calibration_own on public.nemoclaw_calibration;

-- Preserve service role management policy for ingestion/cron paths
drop policy if exists "Service role can manage nemoclaw calibration" on public.nemoclaw_calibration;
create policy "Service role can manage nemoclaw calibration"
  on public.nemoclaw_calibration
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- 4) Ensure user_profiles RLS allows users to maintain own onboarding fields
alter table if exists public.user_profiles enable row level security;

drop policy if exists user_profiles_onboarding_update_own on public.user_profiles;
create policy user_profiles_onboarding_update_own
  on public.user_profiles
  for update
  to authenticated
  using (id = auth.uid() or user_id = auth.uid())
  with check (id = auth.uid() or user_id = auth.uid());

commit;
