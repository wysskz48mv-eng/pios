-- ============================================================
-- M082: Complete onboarding + AI persistence RLS hardening
-- Date: 2026-04-22
-- Purpose:
--   1) Ensure completion endpoint can update onboarding status
--   2) Ensure welcome AI session/message inserts are allowed for authenticated users
--   3) Ensure onboarding_state updates are allowed
--   4) Force-complete users stuck at final onboarding step
-- ============================================================

-- user_profiles: allow authenticated users to update own onboarding/profile row
alter table if exists public.user_profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_profiles'
      and policyname = 'Users can update own profile onboarding status'
  ) then
    create policy "Users can update own profile onboarding status"
      on public.user_profiles
      for update
      to authenticated
      using (auth.uid() = id or auth.uid() = user_id)
      with check (auth.uid() = id or auth.uid() = user_id);
  end if;
end $$;

-- ai_sessions: ensure INSERT/UPDATE policies for own rows
alter table if exists public.ai_sessions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_sessions'
      and policyname = 'Users can insert own AI sessions'
  ) then
    create policy "Users can insert own AI sessions"
      on public.ai_sessions
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_sessions'
      and policyname = 'Users can update own AI sessions'
  ) then
    create policy "Users can update own AI sessions"
      on public.ai_sessions
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- ai_messages: ensure INSERT/UPDATE policies for own rows
alter table if exists public.ai_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_messages'
      and policyname = 'Users can insert own AI messages'
  ) then
    create policy "Users can insert own AI messages"
      on public.ai_messages
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_messages'
      and policyname = 'Users can update own AI messages'
  ) then
    create policy "Users can update own AI messages"
      on public.ai_messages
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- onboarding_state: ensure UPDATE policy exists for own rows
alter table if exists public.onboarding_state enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'onboarding_state'
      and policyname = 'Users can update own onboarding state'
  ) then
    create policy "Users can update own onboarding state"
      on public.onboarding_state
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Emergency backfill: users stuck on final step but not marked complete
update public.user_profiles
set
  onboarding_complete = true,
  onboarding_current_step = 6,
  onboarding_completed_at = coalesce(onboarding_completed_at, now()),
  onboarded = true,
  updated_at = now()
where onboarding_current_step = 6
  and coalesce(onboarding_complete, false) = false;

insert into public.onboarding_state (
  user_id,
  current_step,
  onboarding_complete,
  completed_at,
  last_seen_at,
  updated_at,
  created_at
)
select
  up.id,
  6,
  true,
  coalesce(up.onboarding_completed_at, now()),
  now(),
  now(),
  now()
from public.user_profiles up
where up.onboarding_current_step = 6
  and coalesce(up.onboarding_complete, false) = true
on conflict (user_id)
do update
  set current_step = 6,
      onboarding_complete = true,
      completed_at = coalesce(public.onboarding_state.completed_at, excluded.completed_at),
      last_seen_at = now(),
      updated_at = now();
