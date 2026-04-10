-- ============================================================
-- NemoClaw Capability-Aware AI System
-- Tracks what tools user has, learns preferences, adapts responses
-- ============================================================

-- ── 1. User capabilities profile ────────────────────────────────────────────

create table if not exists public.nemoclaw_user_capabilities (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,

  -- System access (auto-detected)
  has_email               boolean default false,
  email_provider          text,
  has_calendar            boolean default false,
  calendar_provider       text,
  has_tasks               boolean default true,
  task_provider           text default 'pios',
  has_files               boolean default true,
  file_provider           text default 'pios',
  has_crm                 boolean default false,
  crm_provider            text,
  has_slack               boolean default false,
  has_teams               boolean default false,
  has_drive               boolean default false,

  -- User preferences (learned over time)
  preferred_task_system   text default 'pios',
  preferred_reminder      text default 'task',
  preferred_comm_style    text default 'direct',
  preferred_briefing_time text default '08:00',

  -- Learning stats
  total_interactions      integer default 0,
  successful_actions      integer default 0,
  learning_score          numeric(3,2) default 0.5,

  last_validated          timestamptz default now(),
  created_at              timestamptz default now(),
  updated_at              timestamptz default now(),

  unique (user_id)
);

create index if not exists idx_nemoclaw_caps_user on public.nemoclaw_user_capabilities(user_id);

alter table public.nemoclaw_user_capabilities enable row level security;
create policy "nemoclaw_caps_own" on public.nemoclaw_user_capabilities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 2. NemoClaw interaction history (learning data) ─────────────────────────

create table if not exists public.nemoclaw_interactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  session_id        uuid,
  intent            text not null,
  suggested_tool    text,
  chosen_tool       text,
  fallback_used     boolean default false,
  user_satisfied    boolean,
  response_useful   boolean,
  context           jsonb default '{}'::jsonb,
  created_at        timestamptz default now()
);

create index if not exists idx_nemoclaw_int_user on public.nemoclaw_interactions(user_id);
create index if not exists idx_nemoclaw_int_intent on public.nemoclaw_interactions(intent);

alter table public.nemoclaw_interactions enable row level security;
create policy "nemoclaw_int_own" on public.nemoclaw_interactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 3. Auto-create capability profile for existing users ────────────────────

insert into public.nemoclaw_user_capabilities (user_id, has_tasks, task_provider, has_files, file_provider)
select id, true, 'pios', true, 'pios'
from auth.users
where id not in (select user_id from public.nemoclaw_user_capabilities)
on conflict (user_id) do nothing;

-- ── 4. Auto-create on new user signup ───────────────────────────────────────

create or replace function public.handle_new_user_nemoclaw_caps()
returns trigger language plpgsql security definer as $$
begin
  insert into public.nemoclaw_user_capabilities (user_id, has_tasks, task_provider, has_files, file_provider)
  values (new.id, true, 'pios', true, 'pios')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'on_user_created_nemoclaw') then
    create trigger on_user_created_nemoclaw
      after insert on auth.users
      for each row execute function public.handle_new_user_nemoclaw_caps();
  end if;
end $$;
