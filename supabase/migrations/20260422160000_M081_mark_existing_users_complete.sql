begin;

-- ============================================================
-- M081: Emergency unblock for onboarding redirect loop
-- Date: 2026-04-22
-- Purpose:
--   1) Guarantee authenticated users can read their own onboarding_state rows
--   2) Mark pre-onboarding / existing users as complete to prevent lockout
-- ============================================================

alter table if exists public.onboarding_state enable row level security;

-- Ensure SELECT policy exists for onboarding_state (idempotent)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'onboarding_state'
      and policyname = 'Users can read own onboarding state'
  ) then
    create policy "Users can read own onboarding state"
      on public.onboarding_state
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;

-- Mark all existing users as onboarding complete.
update public.user_profiles
set
  onboarding_complete = true,
  onboarding_current_step = 6,
  onboarding_completed_at = coalesce(onboarding_completed_at, now()),
  onboarded = true,
  updated_at = now()
where onboarding_complete is null
   or onboarding_complete = false;

-- Keep onboarding_state in sync for any existing users.
insert into public.onboarding_state (
  user_id,
  current_step,
  onboarding_complete,
  completed_at,
  last_seen_at,
  created_at,
  updated_at
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
on conflict (user_id) do update
set current_step = 6,
    onboarding_complete = true,
    completed_at = coalesce(public.onboarding_state.completed_at, excluded.completed_at),
    last_seen_at = now(),
    updated_at = now();

commit;
