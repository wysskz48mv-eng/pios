-- ============================================================
-- PIOS Sprint 22 — Executive Persona Foundation
-- M015: persona_type, executive tables, EOSA, PAA, STIA
-- VeritasIQ Technologies Ltd
-- ============================================================

-- ── 1. Add persona_type to user_profiles ─────────────────────
alter table public.user_profiles
  add column if not exists persona_type text
    default 'individual'
    check (persona_type in ('student','professional','executive','founder','consultant'));

-- ── 2. Executive Operating System — principles ────────────────
create table if not exists public.exec_principles (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid references public.tenants(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  category    text default 'leadership'
    check (category in ('leadership','decision','values','communication','time','other')),
  sort_order  integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── 3. Decision Log (DAA™) ────────────────────────────────────
create table if not exists public.exec_decisions (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  title           text not null,
  context         text,
  options_json    jsonb default '[]',   -- [{label, pros, cons, score}]
  decision_made   text,
  rationale       text,
  outcome         text,
  framework_used  text,                 -- 'POM','OAE','SDL','CVDM','CPA','SCE','AAM'
  status          text default 'open'
    check (status in ('open','decided','reviewing','closed')),
  decided_at      timestamptz,
  review_date     date,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 4. Review Cadence (EOSA™) ────────────────────────────────
create table if not exists public.exec_reviews (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid references public.tenants(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  cadence       text not null
    check (cadence in ('daily','weekly','monthly','quarterly','annual')),
  title         text not null,
  content       text,
  wins          text[],
  blockers      text[],
  focus_next    text[],
  okr_health    text default 'on_track'
    check (okr_health in ('on_track','at_risk','off_track')),
  ai_summary    text,
  created_at    timestamptz default now()
);

-- ── 5. Stakeholder CRM (STIA™) ────────────────────────────────
create table if not exists public.exec_stakeholders (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid references public.tenants(id) on delete cascade,
  user_id           uuid references auth.users(id) on delete cascade,
  name              text not null,
  role              text,
  organisation      text,
  relationship_type text default 'professional'
    check (relationship_type in ('client','investor','partner','vendor','team','advisor','other','professional')),
  importance        text default 'medium'
    check (importance in ('critical','high','medium','low')),
  last_interaction  timestamptz,
  next_touchpoint   date,
  open_commitments  text[],
  notes             text,
  health_score      integer default 70 check (health_score between 0 and 100),
  tags              text[],
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ── 6. OKR Objectives (PAA™ enhancement) ─────────────────────
create table if not exists public.exec_okrs (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid references public.tenants(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  title         text not null,
  description   text,
  period        text not null,             -- e.g. 'Q1 2026'
  status        text default 'active'
    check (status in ('active','paused','completed','cancelled')),
  health        text default 'on_track'
    check (health in ('on_track','at_risk','off_track')),
  progress      integer default 0 check (progress between 0 and 100),
  ai_commentary text,
  last_reviewed timestamptz,
  due_date      date,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists public.exec_key_results (
  id          uuid primary key default uuid_generate_v4(),
  objective_id uuid references public.exec_okrs(id) on delete cascade,
  tenant_id   uuid references public.tenants(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  title       text not null,
  metric_type text default 'percentage'
    check (metric_type in ('percentage','number','boolean','currency')),
  target      numeric,
  current     numeric default 0,
  unit        text,
  status      text default 'on_track'
    check (status in ('on_track','at_risk','off_track','completed')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── 7. Time blocks (TSA™) ─────────────────────────────────────
create table if not exists public.exec_time_blocks (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid references public.tenants(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  label       text not null,
  block_type  text default 'strategic'
    check (block_type in ('strategic','deep_work','stakeholder','admin','recovery','other')),
  day_of_week integer[],                -- 0=Sun … 6=Sat
  start_time  time,
  end_time    time,
  protected   boolean default true,
  notes       text,
  created_at  timestamptz default now()
);

-- ── 8. RLS ────────────────────────────────────────────────────
alter table public.exec_principles    enable row level security;
alter table public.exec_decisions     enable row level security;
alter table public.exec_reviews       enable row level security;
alter table public.exec_stakeholders  enable row level security;
alter table public.exec_okrs          enable row level security;
alter table public.exec_key_results   enable row level security;
alter table public.exec_time_blocks   enable row level security;

do $$ declare t text; begin
  foreach t in array array[
    'exec_principles','exec_decisions','exec_reviews',
    'exec_stakeholders','exec_okrs','exec_time_blocks'
  ] loop
    execute format('
      create policy if not exists "tenant_rls_%s"
        on public.%s for all using (
          tenant_id = (select tenant_id from public.user_profiles where id = auth.uid())
        )', t, t);
  end loop;
end $$;

create policy if not exists "tenant_rls_exec_key_results"
  on public.exec_key_results for all using (
    tenant_id = (select tenant_id from public.user_profiles where id = auth.uid())
  );

-- ── 9. Indexes ────────────────────────────────────────────────
create index if not exists idx_exec_decisions_user    on public.exec_decisions(user_id, status);
create index if not exists idx_exec_reviews_cadence   on public.exec_reviews(user_id, cadence);
create index if not exists idx_exec_stakeholders_user on public.exec_stakeholders(user_id, importance);
create index if not exists idx_exec_okrs_period       on public.exec_okrs(user_id, period, health);
