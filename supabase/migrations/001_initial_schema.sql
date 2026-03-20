-- ============================================================
-- PIOS v1.0 — Initial Schema
-- Multi-tenant from Day 1. Douglas = tenant_id = first tenant.
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- TENANTS (organisations / users buying PIOS)
-- ============================================================
create table public.tenants (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  slug              text unique not null,
  plan              text not null default 'individual' check (plan in ('student','individual','professional','enterprise')),
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text default 'active' check (subscription_status in ('active','trialing','past_due','canceled','paused')),
  trial_ends_at     timestamptz,
  billing_email     text,
  ai_credits_used   integer default 0,
  ai_credits_limit  integer default 5000,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ============================================================
-- USER PROFILES (extended from Supabase auth.users)
-- ============================================================
create table public.user_profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  tenant_id       uuid references public.tenants(id) on delete cascade,
  full_name       text,
  display_name    text,
  avatar_url      text,
  role            text not null default 'owner' check (role in ('owner','admin','member','viewer')),
  -- Professional context
  job_title       text,
  organisation    text,
  -- Academic context
  programme_name  text,    -- e.g. "DBA — University of Portsmouth"
  programme_type  text,    -- 'dba','mba','msc','phd','undergraduate','cpd','other'
  university      text,
  expected_graduation date,
  -- Google OAuth tokens (for Gmail + Calendar)
  google_access_token  text,
  google_refresh_token text,
  google_token_expiry  timestamptz,
  google_email         text,
  -- Preferences
  timezone        text default 'Europe/London',
  theme           text default 'dark',
  ai_style        text default 'concise',  -- 'concise','detailed','analytical'
  onboarded       boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- ACADEMIC MODULES (thesis, DBA, programme tracking)
-- ============================================================
create table public.academic_modules (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid references public.tenants(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  title       text not null,
  module_code text,
  module_type text default 'taught' check (module_type in ('taught','research','thesis','viva','ethics','publication')),
  status      text default 'upcoming' check (status in ('upcoming','in_progress','submitted','passed','failed','deferred')),
  grade       text,
  credits     integer,
  deadline    date,
  start_date  date,
  end_date    date,
  notes       text,
  sort_order  integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- THESIS CHAPTERS (version-controlled thesis progress)
-- ============================================================
create table public.thesis_chapters (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid references public.tenants(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  title        text not null,
  chapter_num  integer,
  chapter_type text default 'main' check (chapter_type in ('intro','lit_review','methodology','findings','discussion','conclusion','appendix','main')),
  status       text default 'not_started' check (status in ('not_started','drafting','review','supervisor_review','revised','final')),
  word_count   integer default 0,
  target_words integer default 8000,
  content      text,  -- rich text / markdown
  ai_summary   text,
  deadline     date,
  last_edited  timestamptz default now(),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================================
-- SUPERVISION LOG
-- ============================================================
create table public.supervision_sessions (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid references public.tenants(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  supervisor   text,
  session_date date not null,
  session_type text default 'regular' check (session_type in ('regular','panel','viva_mock','ethics','milestone')),
  agenda       text,
  notes        text,
  action_items jsonb default '[]',
  next_session date,
  ai_summary   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================================
-- LITERATURE (research papers, books, references)
-- ============================================================
create table public.literature_items (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid references public.tenants(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  title        text not null,
  authors      text[],
  year         integer,
  source_type  text default 'journal' check (source_type in ('journal','book','conference','report','thesis','website','other')),
  journal      text,
  doi          text,
  url          text,
  zotero_key   text,  -- Zotero integration
  tags         text[],
  themes       text[],
  read_status  text default 'unread' check (read_status in ('unread','reading','read','revisit')),
  relevance    integer check (relevance between 1 and 5),
  notes        text,
  ai_summary   text,
  citation_apa text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================================
-- TASKS (cross-domain: academic, fm, personal, business)
-- ============================================================
create table public.tasks (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid references public.tenants(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  title        text not null,
  description  text,
  domain       text not null default 'personal' check (domain in ('academic','fm_consulting','saas','business','personal')),
  status       text default 'todo' check (status in ('todo','in_progress','blocked','done','cancelled')),
  priority     text default 'medium' check (priority in ('critical','high','medium','low')),
  due_date     timestamptz,
  scheduled_at timestamptz,  -- AI-scheduled time block
  duration_mins integer default 30,
  tags         text[],
  project_id   uuid,  -- FK to projects
  source       text default 'manual' check (source in ('manual','email','ai','calendar')),
  ai_scheduled boolean default false,
  completed_at timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================================
-- PROJECTS (personal, business, research)
-- ============================================================
create table public.projects (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid references public.tenants(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  title        text not null,
  description  text,
  domain       text default 'personal' check (domain in ('academic','fm_consulting','saas','business','personal')),
  status       text default 'active' check (status in ('active','on_hold','completed','cancelled')),
  priority     text default 'medium' check (priority in ('critical','high','medium','low')),
  start_date   date,
  due_date     date,
  progress     integer default 0 check (progress between 0 and 100),
  tags         text[],
  colour       text default '#6c8eff',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Add FK after projects table created
alter table public.tasks add constraint tasks_project_id_fkey 
  foreign key (project_id) references public.projects(id) on delete set null;

-- ============================================================
-- CALENDAR EVENTS (synced from Google + manual)
-- ============================================================
create table public.calendar_events (
  id             uuid primary key default uuid_generate_v4(),
  tenant_id      uuid references public.tenants(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete cascade,
  google_event_id text,
  title          text not null,
  description    text,
  domain         text default 'personal',
  start_time     timestamptz not null,
  end_time       timestamptz not null,
  all_day        boolean default false,
  location       text,
  attendees      jsonb default '[]',
  is_focus_time  boolean default false,
  is_ai_blocked  boolean default false,  -- blocked by AI scheduling
  google_meet_url text,
  ai_brief       text,  -- AI pre-meeting brief
  ai_notes       text,  -- AI post-meeting notes
  action_items   jsonb default '[]',
  source         text default 'manual' check (source in ('manual','google','ai')),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ============================================================
-- EMAIL TRIAGE (autonomous inbox management)
-- ============================================================
create table public.email_items (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  gmail_message_id text,
  gmail_thread_id  text,
  subject         text,
  sender_name     text,
  sender_email    text,
  received_at     timestamptz,
  snippet         text,
  body_text       text,
  domain_tag      text,  -- AI-classified domain
  priority_score  integer,  -- 1-10 AI priority
  action_required text,  -- AI-extracted action
  ai_draft_reply  text,  -- AI-generated reply draft
  status          text default 'unprocessed' check (status in ('unprocessed','triaged','actioned','archived','ignored')),
  task_created    boolean default false,
  task_id         uuid references public.tasks(id) on delete set null,
  processed_at    timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- EXPENSES (personal finance tracker)
-- ============================================================
create table public.expenses (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid references public.tenants(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  description  text not null,
  amount       numeric(10,2) not null,
  currency     text default 'GBP',
  category     text,  -- e.g. 'travel','software','research','consulting'
  domain       text default 'personal',
  date         date not null,
  receipt_url  text,
  billable     boolean default false,
  client       text,
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================================
-- AI CHAT SESSIONS (PIOS AI Companion history)
-- ============================================================
create table public.ai_sessions (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid references public.tenants(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  title       text,
  messages    jsonb default '[]',
  domain      text default 'general',
  tokens_used integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- AI DAILY BRIEFS (morning cross-domain briefing)
-- ============================================================
create table public.daily_briefs (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid references public.tenants(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  brief_date   date not null,
  content      text,
  priorities   jsonb default '[]',
  clashes      jsonb default '[]',
  academic_summary text,
  tasks_summary    text,
  calendar_summary text,
  email_summary    text,
  ai_model     text default 'claude-sonnet-4-20250514',
  tokens_used  integer default 0,
  created_at   timestamptz default now(),
  unique(user_id, brief_date)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid references public.tenants(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  title       text not null,
  body        text,
  type        text default 'info' check (type in ('info','warning','critical','success','ai')),
  domain      text,
  action_url  text,
  read        boolean default false,
  created_at  timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.tenants enable row level security;
alter table public.user_profiles enable row level security;
alter table public.academic_modules enable row level security;
alter table public.thesis_chapters enable row level security;
alter table public.supervision_sessions enable row level security;
alter table public.literature_items enable row level security;
alter table public.tasks enable row level security;
alter table public.projects enable row level security;
alter table public.calendar_events enable row level security;
alter table public.email_items enable row level security;
alter table public.expenses enable row level security;
alter table public.ai_sessions enable row level security;
alter table public.daily_briefs enable row level security;
alter table public.notifications enable row level security;

-- Helper function
create or replace function public.get_tenant_id()
returns uuid language sql security definer stable as $$
  select tenant_id from public.user_profiles where id = auth.uid()
$$;

-- RLS Policies — users see only their tenant's data
do $$ 
declare
  tbl text;
begin
  foreach tbl in array array[
    'academic_modules','thesis_chapters','supervision_sessions',
    'literature_items','tasks','projects','calendar_events',
    'email_items','expenses','ai_sessions','daily_briefs','notifications'
  ] loop
    execute format('create policy "%s_tenant_isolation" on public.%s
      using (tenant_id = public.get_tenant_id())', tbl, tbl);
  end loop;
end $$;

-- user_profiles: see own profile
create policy "user_profiles_own" on public.user_profiles
  using (id = auth.uid());

-- tenants: see own tenant
create policy "tenants_own" on public.tenants
  using (id = public.get_tenant_id());

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_tasks_user_domain on public.tasks(user_id, domain);
create index idx_tasks_due_date on public.tasks(due_date) where status not in ('done','cancelled');
create index idx_calendar_events_user_time on public.calendar_events(user_id, start_time);
create index idx_email_items_status on public.email_items(user_id, status);
create index idx_literature_user on public.literature_items(user_id, read_status);
create index idx_projects_user on public.projects(user_id, status);
create index idx_notifications_user_unread on public.notifications(user_id, read) where read = false;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'tenants','user_profiles','academic_modules','thesis_chapters',
    'supervision_sessions','literature_items','tasks','projects',
    'calendar_events','email_items','expenses','ai_sessions','daily_briefs'
  ] loop
    execute format('create trigger %s_updated_at before update on public.%s
      for each row execute function public.handle_updated_at()', tbl, tbl);
  end loop;
end $$;

-- ============================================================
-- SEED: Douglas as Tenant 1 (run after auth user created)
-- ============================================================
-- insert into public.tenants (name, slug, plan)
--   values ('Douglas Masuku', 'douglas', 'professional');
