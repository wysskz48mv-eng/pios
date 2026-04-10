-- ============================================================
-- PIOS: Tier-based agent activation system
-- user_agent_subscriptions — controls who can run agents and when
-- agent_execution_log — audit trail of every agent run
-- ============================================================

-- ── 1. User Agent Subscriptions ─────────────────────────────────────────────

create table if not exists public.user_agent_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  subscription_tier      text not null default 'free'
    check (subscription_tier in ('free', 'student', 'individual', 'pro', 'professional')),
  has_agent_access       boolean default true,
  agent_access_granted_at timestamptz,
  next_agent_run         timestamptz,
  last_agent_run         timestamptz,
  agent_run_count        integer default 0,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now(),

  unique (user_id)
);

create index if not exists idx_user_agent_subs_tier on public.user_agent_subscriptions(subscription_tier);
create index if not exists idx_user_agent_subs_next_run on public.user_agent_subscriptions(next_agent_run);
create index if not exists idx_user_agent_subs_user on public.user_agent_subscriptions(user_id);

alter table public.user_agent_subscriptions enable row level security;

create policy "user_agent_subs_own" on public.user_agent_subscriptions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 2. Agent Execution Log ──────────────────────────────────────────────────

create table if not exists public.agent_execution_log (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  agent_name          text not null,
  execution_status    text not null default 'success'
    check (execution_status in ('success', 'failed', 'skipped', 'gated')),
  execution_reason    text,
  subscription_tier   text,
  result_summary      jsonb,
  execution_time_ms   integer,
  execution_time      timestamptz default now(),
  next_scheduled_run  timestamptz
);

create index if not exists idx_agent_log_user on public.agent_execution_log(user_id);
create index if not exists idx_agent_log_agent on public.agent_execution_log(agent_name);
create index if not exists idx_agent_log_exec_time on public.agent_execution_log(execution_time desc);

-- No RLS — service role only (edge functions write, admin reads)

-- ── 3. Seed subscriptions for existing users ────────────────────────────────

insert into public.user_agent_subscriptions (user_id, subscription_tier, has_agent_access, agent_access_granted_at, next_agent_run)
select
  id,
  'free',
  true,
  now(),
  now() + interval '1 day'
from auth.users
where id not in (select user_id from public.user_agent_subscriptions)
on conflict (user_id) do nothing;

-- ── 4. Auto-create subscription on new user signup ──────────────────────────

create or replace function public.handle_new_user_agent_subscription()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_agent_subscriptions (user_id, subscription_tier, has_agent_access, agent_access_granted_at, next_agent_run)
  values (new.id, 'free', true, now(), now() + interval '1 day')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'on_user_created_agent_sub') then
    create trigger on_user_created_agent_sub
      after insert on auth.users
      for each row execute function public.handle_new_user_agent_subscription();
  end if;
end $$;

-- ── 5. Updated_at trigger ───────────────────────────────────────────────────

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'user_agent_subs_updated_at') then
    create trigger user_agent_subs_updated_at before update on public.user_agent_subscriptions
      for each row execute function public.handle_updated_at();
  end if;
end $$;
