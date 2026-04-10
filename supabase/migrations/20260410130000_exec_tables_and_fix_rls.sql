-- ============================================================
-- PIOS: Create exec tables (if missing) and fix RLS policies
-- Changes tenant_id-based RLS to user_id-based RLS so users
-- without a tenant_id can still access their own data.
-- ============================================================

-- ── 1. Create tables if not exists ──────────────────────────────────────────

create table if not exists public.exec_principles (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid,
  user_id     uuid references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  category    text default 'leadership',
  sort_order  integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists public.exec_decisions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid,
  user_id         uuid references auth.users(id) on delete cascade,
  title           text not null,
  context         text,
  options_json    jsonb default '[]',
  decision_made   text,
  rationale       text,
  outcome         text,
  framework_used  text,
  status          text default 'open',
  decided_at      timestamptz,
  review_date     date,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists public.exec_reviews (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid,
  user_id       uuid references auth.users(id) on delete cascade,
  cadence       text not null,
  title         text not null,
  content       text,
  wins          text[],
  blockers      text[],
  focus_next    text[],
  okr_health    text default 'on_track',
  ai_summary    text,
  created_at    timestamptz default now()
);

create table if not exists public.exec_stakeholders (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid,
  user_id           uuid references auth.users(id) on delete cascade,
  name              text not null,
  role              text,
  organisation      text,
  relationship_type text default 'professional',
  importance        text default 'medium',
  last_interaction  timestamptz,
  next_touchpoint   date,
  open_commitments  text[],
  notes             text,
  health_score      integer default 70,
  tags              text[],
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create table if not exists public.exec_okrs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid,
  user_id       uuid references auth.users(id) on delete cascade,
  title         text not null,
  description   text,
  period        text not null,
  status        text default 'active',
  health        text default 'on_track',
  progress      integer default 0,
  ai_commentary text,
  last_reviewed timestamptz,
  due_date      date,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists public.exec_key_results (
  id           uuid primary key default gen_random_uuid(),
  objective_id uuid references public.exec_okrs(id) on delete cascade,
  tenant_id    uuid,
  user_id      uuid references auth.users(id) on delete cascade,
  title        text not null,
  metric_type  text default 'percentage',
  target       numeric,
  current      numeric default 0,
  unit         text,
  status       text default 'on_track',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table if not exists public.exec_time_blocks (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid,
  user_id     uuid references auth.users(id) on delete cascade,
  label       text not null,
  block_type  text default 'strategic',
  day_of_week integer[],
  start_time  time,
  end_time    time,
  protected   boolean default true,
  notes       text,
  created_at  timestamptz default now()
);

-- ── 2. Enable RLS ───────────────────────────────────────────────────────────

alter table public.exec_principles    enable row level security;
alter table public.exec_decisions     enable row level security;
alter table public.exec_reviews       enable row level security;
alter table public.exec_stakeholders  enable row level security;
alter table public.exec_okrs          enable row level security;
alter table public.exec_key_results   enable row level security;
alter table public.exec_time_blocks   enable row level security;

-- ── 3. Drop old tenant_id-based policies and create user_id-based ones ──────

do $$ declare t text; begin
  foreach t in array array[
    'exec_principles','exec_decisions','exec_reviews',
    'exec_stakeholders','exec_okrs','exec_key_results','exec_time_blocks'
  ] loop
    -- Drop old tenant-based policy if it exists
    execute format('drop policy if exists "tenant_rls_%s" on public.%s', t, t);
    -- Create new user_id-based policy
    execute format('
      create policy "user_rls_%s" on public.%s
        for all using (auth.uid() = user_id)
        with check (auth.uid() = user_id)', t, t);
  end loop;
end $$;

-- ── 4. Indexes ──────────────────────────────────────────────────────────────

create index if not exists idx_exec_principles_user    on public.exec_principles(user_id);
create index if not exists idx_exec_decisions_user     on public.exec_decisions(user_id, status);
create index if not exists idx_exec_reviews_cadence    on public.exec_reviews(user_id, cadence);
create index if not exists idx_exec_stakeholders_user  on public.exec_stakeholders(user_id, importance);
create index if not exists idx_exec_okrs_period        on public.exec_okrs(user_id, period, health);
create index if not exists idx_exec_key_results_obj    on public.exec_key_results(objective_id);
create index if not exists idx_exec_time_blocks_user   on public.exec_time_blocks(user_id);
