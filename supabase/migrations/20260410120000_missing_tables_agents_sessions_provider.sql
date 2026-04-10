-- ============================================================
-- PIOS Migration: Create missing tables
-- user_agents, ai_sessions, ai_provider_config, ai_provider_health_log
-- All with RLS policies enforcing user_id = auth.uid()
-- ============================================================

-- ── AI Sessions (conversation history) ──────────────────────────────────────
-- Note: M001 in admin/migrate defines this table but it was never added to
-- the main migrations. This uses IF NOT EXISTS for safety.

create table if not exists public.ai_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text default 'New conversation',
  domain       text default 'general',
  messages     jsonb default '[]'::jsonb,
  tokens_used  integer default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists idx_ai_sessions_user_id on public.ai_sessions(user_id);
create index if not exists idx_ai_sessions_updated_at on public.ai_sessions(updated_at desc);

alter table public.ai_sessions enable row level security;

drop policy if exists "ai_sessions_own" on public.ai_sessions;
create policy "ai_sessions_own" on public.ai_sessions
  for all using (auth.uid() = user_id);


-- ── User Agents (background agent state per user) ───────────────────────────

create table if not exists public.user_agents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  agent_id        text not null,
  enabled         boolean default true,
  config          jsonb default '{}'::jsonb,
  last_run_at     timestamptz,
  last_run_status text default 'never_run',
  last_run_output text,
  last_run_ms     integer,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  unique (user_id, agent_id)
);

create index if not exists idx_user_agents_user_id on public.user_agents(user_id);
create index if not exists idx_user_agents_agent_id on public.user_agents(agent_id);

alter table public.user_agents enable row level security;

drop policy if exists "user_agents_own" on public.user_agents;
create policy "user_agents_own" on public.user_agents
  for all using (auth.uid() = user_id);


-- ── AI Provider Config (failover configuration) ────────────────────────────

create table if not exists public.ai_provider_config (
  id                    uuid primary key default gen_random_uuid(),
  provider_name         text not null unique,
  role                  text not null default 'primary'
                        check (role in ('primary', 'fallback_1', 'fallback_2')),
  is_active             boolean default true,
  consecutive_failures  integer default 0,
  last_success_at       timestamptz,
  last_failure_at       timestamptz,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- Seed default provider config
insert into public.ai_provider_config (provider_name, role, is_active) values
  ('anthropic', 'primary',    true),
  ('openai',    'fallback_1', true),
  ('gemini',    'fallback_2', true)
on conflict (provider_name) do nothing;

-- No RLS — accessed via service role key only (server-side failover logic)


-- ── AI Provider Health Log (telemetry) ──────────────────────────────────────

create table if not exists public.ai_provider_health_log (
  id                  uuid primary key default gen_random_uuid(),
  provider_name       text not null,
  check_type          text default 'completion',
  success             boolean not null,
  latency_ms          integer,
  error_code          text,
  error_message       text,
  failover_triggered  boolean default false,
  failover_to         text,
  created_at          timestamptz default now()
);

create index if not exists idx_ai_health_log_provider on public.ai_provider_health_log(provider_name);
create index if not exists idx_ai_health_log_created on public.ai_provider_health_log(created_at desc);

-- No RLS — service role only (telemetry writes from server)


-- ── Updated_at triggers ─────────────────────────────────────────────────────

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'ai_sessions_updated_at') then
    create trigger ai_sessions_updated_at before update on public.ai_sessions
      for each row execute function public.handle_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'user_agents_updated_at') then
    create trigger user_agents_updated_at before update on public.user_agents
      for each row execute function public.handle_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'ai_provider_config_updated_at') then
    create trigger ai_provider_config_updated_at before update on public.ai_provider_config
      for each row execute function public.handle_updated_at();
  end if;
end $$;
