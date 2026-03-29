import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Client } from 'pg'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MIGRATIONS: Record<string, { name: string; sentinel_table: string; sql: string }> = {
  '001': {
    name: "M001: Initial schema \u2014 user_profiles, tasks, projects, academic, calendar, literature, expenses, ai_sessions, daily_briefs",
    sentinel_table: "user_profiles",
    sql: `-- ============================================================
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
--   values ('Admin User', 'admin', 'professional');
`,
  },
  '002': {
    name: "M002: Dedup & seed",
    sentinel_table: "user_profiles",
    sql: `-- ============================================================
-- PIOS Migration 002 — Dedup and clean seed data
-- Run in Supabase SQL Editor after initial seed
-- ============================================================

-- Remove duplicate tasks (keep most recent by created_at)
DELETE FROM public.tasks
WHERE id NOT IN (
  SELECT DISTINCT ON (title, user_id) id
  FROM public.tasks
  ORDER BY title, user_id, created_at DESC
);

-- Remove duplicate academic_modules (keep most recent)
DELETE FROM public.academic_modules
WHERE id NOT IN (
  SELECT DISTINCT ON (title, user_id) id
  FROM public.academic_modules
  ORDER BY title, user_id, created_at DESC
);

-- Remove duplicate thesis_chapters (keep most recent)
DELETE FROM public.thesis_chapters
WHERE id NOT IN (
  SELECT DISTINCT ON (chapter_num, user_id) id
  FROM public.thesis_chapters
  ORDER BY chapter_num, user_id, created_at DESC
);

-- Remove duplicate projects (keep most recent)
DELETE FROM public.projects
WHERE id NOT IN (
  SELECT DISTINCT ON (title, user_id) id
  FROM public.projects
  ORDER BY title, user_id, created_at DESC
);

-- Remove duplicate notifications (keep most recent)
DELETE FROM public.notifications
WHERE id NOT IN (
  SELECT DISTINCT ON (title, user_id) id
  FROM public.notifications
  ORDER BY title, user_id, created_at DESC
);

-- Verify final counts
SELECT 
  (SELECT COUNT(*) FROM public.tasks) as tasks,
  (SELECT COUNT(*) FROM public.academic_modules) as modules,
  (SELECT COUNT(*) FROM public.thesis_chapters) as chapters,
  (SELECT COUNT(*) FROM public.projects) as projects,
  (SELECT COUNT(*) FROM public.notifications) as notifications,
  (SELECT COUNT(*) FROM public.expenses) as expenses;
`,
  },
  '003': {
    name: "M003: Google token refresh",
    sentinel_table: "google_tokens",
    sql: `-- ============================================================
-- PIOS Migration 003 — Google token refresh helper
-- Adds a DB function to check if a Google token is expired
-- ============================================================

-- Function: returns true if google_token_expiry is within 5 minutes or past
CREATE OR REPLACE FUNCTION public.google_token_needs_refresh(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT google_token_expiry < NOW() + INTERVAL '5 minutes'
     FROM public.user_profiles WHERE id = user_uuid),
    true
  );
$$;

-- Grant execute to authenticated users (for their own check)
GRANT EXECUTE ON FUNCTION public.google_token_needs_refresh(uuid) TO authenticated;

-- Add index on google_token_expiry for fast expiry checks
CREATE INDEX IF NOT EXISTS idx_user_profiles_token_expiry
  ON public.user_profiles(google_token_expiry)
  WHERE google_token_expiry IS NOT NULL;

-- Verify
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'google_token_needs_refresh';
`,
  },
  '004': {
    name: "M004: Research \u2014 journal_watchlist, paper_calls, fm_news_items",
    sentinel_table: "journal_watchlist",
    sql: `-- ============================================================
-- PIOS Migration 004 — Research Infrastructure
-- Journal watchlist, CFP tracker, FM news feeds, DB searches
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Journal watchlist ─────────────────────────────────────────────────────
-- Journals Douglas is targeting for publication
create table if not exists public.journal_watchlist (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references auth.users(id) on delete cascade,
  journal_name      text not null,
  issn              text,
  publisher         text,
  impact_factor     numeric(6,3),
  quartile          text check (quartile in ('Q1','Q2','Q3','Q4','Unranked')),
  subject_area      text,
  scope_notes       text,                    -- what topics they cover
  submission_url    text,
  guidelines_url    text,
  template_url      text,
  review_process    text default 'double_blind' check (review_process in ('single_blind','double_blind','open','post_publication')),
  typical_turnaround_days integer,
  word_limit        integer,
  open_access       boolean default false,
  apc_usd           integer,                 -- article processing charge
  is_scopus_indexed boolean default true,
  priority          text default 'medium' check (priority in ('high','medium','low','watch')),
  status            text default 'researching' check (status in ('researching','drafting','submitted','under_review','accepted','rejected','published')),
  submission_date   date,
  decision_date     date,
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ── 2. Calls for papers tracker ──────────────────────────────────────────────
create table if not exists public.paper_calls (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references auth.users(id) on delete cascade,
  title            text not null,            -- e.g. "Special Issue: AI in FM"
  journal_name     text,
  conference_name  text,
  call_type        text default 'special_issue' check (call_type in ('special_issue','regular_issue','conference','workshop','book_chapter')),
  topic_summary    text,
  deadline         date,
  submission_url   text,
  relevance_score  integer check (relevance_score between 1 and 5),
  status           text default 'new' check (status in ('new','considering','planning','dismissed')),
  source_url       text,                     -- where the CFP was found
  notes            text,
  created_at       timestamptz default now()
);

-- ── 3. FM industry news items ────────────────────────────────────────────────
-- Cached news articles from live FM domain searches
create table if not exists public.fm_news_items (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete cascade,
  headline     text not null,
  summary      text,
  source       text,
  source_url   text,
  published_at timestamptz,
  category     text default 'general' check (category in (
    'general','technology','regulation','market','sustainability',
    'giga_projects','middle_east','standards','workforce','ai_fm'
  )),
  relevance    integer check (relevance between 1 and 5),
  saved        boolean default false,
  read         boolean default false,
  fetched_at   timestamptz default now()
);

-- ── 4. Academic database searches ────────────────────────────────────────────
-- Log of searches run across Scopus / Web of Science / Google Scholar
create table if not exists public.database_searches (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade,
  query         text not null,
  database_name text default 'scopus' check (database_name in (
    'scopus','web_of_science','google_scholar','ieee','pubmed',
    'jstor','emerald','taylor_francis','sage','other'
  )),
  filters       jsonb default '{}'::jsonb,   -- year range, subject area, etc.
  result_count  integer,
  results       jsonb default '[]'::jsonb,   -- array of {title, authors, year, doi, abstract}
  notes         text,
  created_at    timestamptz default now()
);

-- ── 5. Row-level security ────────────────────────────────────────────────────
alter table public.journal_watchlist  enable row level security;
alter table public.paper_calls        enable row level security;
alter table public.fm_news_items      enable row level security;
alter table public.database_searches  enable row level security;

create policy "own_journals"   on public.journal_watchlist  for all using (auth.uid() = user_id);
create policy "own_cfps"       on public.paper_calls        for all using (auth.uid() = user_id);
create policy "own_fm_news"    on public.fm_news_items      for all using (auth.uid() = user_id);
create policy "own_db_searches" on public.database_searches  for all using (auth.uid() = user_id);

-- ── 6. Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_journal_watchlist_user   on public.journal_watchlist(user_id);
create index if not exists idx_paper_calls_user         on public.paper_calls(user_id, deadline);
create index if not exists idx_fm_news_user             on public.fm_news_items(user_id, fetched_at desc);
create index if not exists idx_db_searches_user         on public.database_searches(user_id, created_at desc);

-- ── 7. Seed: Douglas's target journals ───────────────────────────────────────
-- Run after auth to get user_id, or update user_id manually
-- These are representative FM/AI/management journals relevant to DBA research

do $$
declare v_user_id uuid;
begin
  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then return; end if;

  insert into public.journal_watchlist (user_id, journal_name, publisher, impact_factor, quartile, subject_area, scope_notes, submission_url, guidelines_url, review_process, word_limit, open_access, is_scopus_indexed, priority, status) values

  (v_user_id, 'Facilities', 'Emerald', 1.8, 'Q2', 'Facilities Management', 'FM strategy, workplace management, built environment. Strong alignment with GCC FM research.', 'https://www.emerald.com/insight/publication/issn/0263-2772', 'https://www.emerald.com/insight/publication/issn/0263-2772/author-guidelines', 'double_blind', 8000, false, true, 'high', 'researching'),

  (v_user_id, 'Journal of Facilities Management', 'Emerald', 1.6, 'Q2', 'Facilities Management', 'Strategic FM, outsourcing, sustainability, smart buildings. Key outlet for FM academic work.', 'https://www.emerald.com/insight/publication/issn/1472-5967', 'https://www.emerald.com/insight/publication/issn/1472-5967/author-guidelines', 'double_blind', 8000, false, true, 'high', 'researching'),

  (v_user_id, 'Construction Management and Economics', 'Taylor & Francis', 3.2, 'Q1', 'Built Environment / FM', 'Construction, FM lifecycle, asset management. High impact, competitive.', 'https://www.tandfonline.com/journals/rcme20', 'https://www.tandfonline.com/action/authorSubmission?journalCode=rcme20', 'double_blind', 9000, false, true, 'medium', 'researching'),

  (v_user_id, 'International Journal of Strategic Property Management', 'Taylor & Francis', 2.1, 'Q2', 'Property / FM / AI', 'Property and FM strategy, asset management, smart real estate. Open access option.', 'https://www.tandfonline.com/journals/tspm20', 'https://www.tandfonline.com/action/authorSubmission?journalCode=tspm20', 'double_blind', 8000, false, true, 'high', 'researching'),

  (v_user_id, 'Technological Forecasting and Social Change', 'Elsevier', 12.9, 'Q1', 'AI / Technology / Management', 'AI adoption, digital transformation, foresight — strong STS theory alignment for DBA research.', 'https://www.sciencedirect.com/journal/technological-forecasting-and-social-change', 'https://www.sciencedirect.com/journal/technological-forecasting-and-social-change/publish/guide-for-authors', 'double_blind', 12000, false, true, 'medium', 'researching'),

  (v_user_id, 'Journal of Building Engineering', 'Elsevier', 6.4, 'Q1', 'Built Environment / AI', 'Smart buildings, IoT, AI in construction and FM. High impact, Scopus indexed.', 'https://www.sciencedirect.com/journal/journal-of-building-engineering', 'https://www.sciencedirect.com/journal/journal-of-building-engineering/publish/guide-for-authors', 'double_blind', 10000, false, true, 'medium', 'researching'),

  (v_user_id, 'Automation in Construction', 'Elsevier', 9.8, 'Q1', 'AI / Construction / FM', 'AI, machine learning, automation in built environment. Premium outlet for AI-FM research.', 'https://www.sciencedirect.com/journal/automation-in-construction', 'https://www.sciencedirect.com/journal/automation-in-construction/publish/guide-for-authors', 'double_blind', 10000, false, true, 'watch', 'researching');

end $$;

-- ── 8. Verify ────────────────────────────────────────────────────────────────
select
  (select count(*) from public.journal_watchlist)  as journals_seeded,
  (select count(*) from public.paper_calls)         as cfps,
  (select count(*) from public.fm_news_items)       as news_items,
  (select count(*) from public.database_searches)   as searches;
`,
  },
  '005': {
    name: "M005: User feed config",
    sentinel_table: "user_feed_configs",
    sql: `-- ============================================================
-- PIOS Migration 005 — User Feed Configuration
-- Per-user configurable news feed preferences for Command Centre
-- ============================================================

-- ── 1. Feed topics table ─────────────────────────────────────────────────────
-- Each row is one topic/feed channel the user has configured.
-- Users can have multiple feeds displayed in their Command Centre.
create table if not exists public.user_feed_topics (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,

  -- Display
  label         text not null,              -- User-facing name, e.g. "GCC FM Market"
  description   text,                       -- What this feed covers
  emoji         text default '📰',          -- Icon for the feed card

  -- Feed configuration
  topic         text not null,              -- Core topic prompt, e.g. "facilities management GCC Saudi Arabia"
  keywords      text[] default '{}',        -- Additional keywords to include
  sources       text[] default '{}',        -- Preferred sources (e.g. FM World, MEED, RICS)
  exclude_terms text[] default '{}',        -- Terms to exclude from results

  -- Layout & behaviour
  sort_order    integer default 0,
  is_active     boolean default true,
  layout        text default 'cards' check (layout in ('cards','list','headlines')),
  refresh_freq  text default 'daily' check (refresh_freq in ('realtime','hourly','daily','weekly')),
  max_items     integer default 8 check (max_items between 3 and 20),

  -- Feed category (drives colour coding and grouping)
  category      text default 'industry' check (category in (
    'industry',      -- FM, real estate, construction market
    'academic',      -- Research journals, calls for papers, academic news
    'regulatory',    -- Standards, legislation, government policy
    'technology',    -- AI, PropTech, smart buildings
    'business',      -- Company news, M&A, financial
    'personal'       -- Custom user-defined
  )),

  -- Cache
  last_fetched  timestamptz,
  cached_items  jsonb default '[]'::jsonb,  -- Last fetched items stored here

  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── 2. Feed settings (global per user) ───────────────────────────────────────
create table if not exists public.user_feed_settings (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  command_layout      text default 'grid' check (command_layout in ('grid','list','focused')),
  brief_include_feeds boolean default true,     -- Include top feed items in morning brief
  brief_feed_count    integer default 3,        -- How many feed items to inject into brief
  auto_refresh        boolean default true,     -- Auto-refresh feeds on Command Centre load
  show_relevance      boolean default true,     -- Show AI relevance score on items
  default_category    text default 'industry',
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── 3. RLS ───────────────────────────────────────────────────────────────────
alter table public.user_feed_topics   enable row level security;
alter table public.user_feed_settings enable row level security;

create policy "own_feed_topics"   on public.user_feed_topics   for all using (auth.uid() = user_id);
create policy "own_feed_settings" on public.user_feed_settings for all using (auth.uid() = user_id);

-- ── 4. Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_feed_topics_user   on public.user_feed_topics(user_id, sort_order);
create index if not exists idx_feed_settings_user on public.user_feed_settings(user_id);

-- ── 5. Seed Douglas's default feeds ─────────────────────────────────────────
do $$
declare v_user_id uuid;
begin
  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then return; end if;

  -- Insert default feed settings
  insert into public.user_feed_settings (user_id, command_layout, brief_include_feeds, brief_feed_count)
  values (v_user_id, 'grid', true, 3)
  on conflict (user_id) do nothing;

  -- Insert 6 default feed topics
  insert into public.user_feed_topics
    (user_id, label, description, emoji, topic, keywords, sources, sort_order, category, max_items)
  values

  (v_user_id,
   'GCC FM Market',
   'Facilities management market news across Saudi Arabia, UAE, Qatar and wider GCC',
   '🏗️',
   'facilities management GCC Saudi Arabia UAE Qatar market news',
   ARRAY['NEOM','Qiddiya','giga-project','service charge','FM outsourcing','Vision 2030'],
   ARRAY['MEED','Arab News','Construction Week','FM World Middle East','The National'],
   0, 'industry', 8),

  (v_user_id,
   'AI & PropTech',
   'Artificial intelligence, smart buildings, digital twins and property technology',
   '🤖',
   'artificial intelligence facilities management smart buildings digital twin PropTech',
   ARRAY['predictive maintenance','IoT FM','BIM','CAFM','AI adoption','machine learning FM'],
   ARRAY['FM World','RICS','Facilities Management Journal','Building Design','Construction Dive'],
   1, 'technology', 8),

  (v_user_id,
   'FM Standards & Regulation',
   'ISO 55001, RICS standards, BIFM publications, regulatory updates',
   '📋',
   'ISO 55001 asset management standard RICS facilities management regulation BIFM',
   ARRAY['ISO 55001','ISO 41001','EN 15221','RICS FM code','BIFM guidance','CIBSE'],
   ARRAY['RICS','BSI','ISO','BIFM','IFMA'],
   2, 'regulatory', 6),

  (v_user_id,
   'Academic FM Research',
   'New publications, journal articles and research on FM, AI adoption and built environment',
   '🎓',
   'academic research facilities management AI adoption built environment journal articles',
   ARRAY['Facilities journal','STS theory','sensemaking','AI FM research','DBA research','GCC built environment'],
   ARRAY['Emerald Publishing','Taylor & Francis','Elsevier','IFMA Foundation','EuroFM'],
   3, 'academic', 6),

  (v_user_id,
   'SustainEdge Competitive Intel',
   'Service charge management software, proptech competitors, FM SaaS market',
   '📊',
   'service charge management software SaaS facilities management platform proptech',
   ARRAY['Yardi','MRI Software','Planon','Facilio','CAFM Explorer','service charge software'],
   ARRAY['Property Week','EG','CoStar','PropTech Insider','Real Estate Tech News'],
   4, 'business', 6),

  (v_user_id,
   'FM Sustainability & ESG',
   'Net zero buildings, ESG in FM, green certification, carbon reporting',
   '🌱',
   'sustainability ESG facilities management net zero buildings carbon reporting green',
   ARRAY['net zero','BREEAM','LEED','carbon footprint FM','ESG reporting built environment','green FM'],
   ARRAY['BREEAM','Green Building Council','RICS','Sustainability Built Environment','CIBSE'],
   5, 'industry', 6);

end $$;

-- ── 6. Verify ────────────────────────────────────────────────────────────────
select
  (select count(*) from public.user_feed_topics)   as feed_topics_seeded,
  (select count(*) from public.user_feed_settings) as feed_settings_seeded;
`,
  },
  '006': {
    name: "M006: Filing system",
    sentinel_table: "filing_categories",
    sql: `-- ============================================================
-- PIOS Migration 006 — File Intelligence & Filing System
-- Drive integration, invoice extraction, filing rules
-- ============================================================

-- ── 1. File spaces (virtual folder structure) ────────────────────────────────
-- Mirrors the organised folder structure PIOS maintains
create table if not exists public.file_spaces (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  name          text not null,
  path          text not null,              -- e.g. /Projects/Qiddiya/Contracts
  parent_id     uuid references public.file_spaces(id) on delete cascade,
  space_type    text default 'folder' check (space_type in (
    'folder','project','company','academic','personal','archive','inbox'
  )),
  drive_folder_id text,                     -- Google Drive folder ID (if synced)
  colour        text default '#6c8eff',
  icon          text default '📁',
  sort_order    integer default 0,
  is_auto       boolean default false,      -- created by PIOS agent vs user
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── 2. File items (catalogued files) ────────────────────────────────────────
create table if not exists public.file_items (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  space_id        uuid references public.file_spaces(id) on delete set null,

  -- File identity
  name            text not null,
  file_type       text,                     -- pdf, docx, xlsx, jpg, etc.
  mime_type       text,
  size_bytes      bigint,

  -- Source location
  source          text default 'drive' check (source in ('drive','email','upload','local')),
  drive_file_id   text,                     -- Google Drive file ID
  drive_web_url   text,                     -- Direct view link
  gmail_message_id text,                    -- If sourced from email attachment

  -- AI classification
  ai_category     text check (ai_category in (
    'invoice','contract','report','proposal','correspondence',
    'technical','financial','legal','personal','academic',
    'presentation','spreadsheet','image','other'
  )),
  ai_project_tag  text,                     -- Matched project name
  ai_company_tag  text,                     -- Matched company entity
  ai_summary      text,                     -- One-paragraph AI summary
  ai_confidence   numeric(3,2),             -- 0.00–1.00

  -- Filing state
  filing_status   text default 'unprocessed' check (filing_status in (
    'unprocessed','classified','filed','duplicate','archived','review_needed'
  )),
  is_duplicate    boolean default false,
  duplicate_of    uuid references public.file_items(id),

  -- Metadata
  document_date   date,                     -- Date extracted from document
  tags            text[] default '{}',
  notes           text,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 3. Invoices (extracted invoice data) ────────────────────────────────────
create table if not exists public.invoices (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  file_item_id    uuid references public.file_items(id) on delete set null,
  email_item_id   uuid references public.email_items(id) on delete set null,

  -- Invoice identity
  invoice_number  text,
  invoice_type    text default 'receivable' check (invoice_type in (
    'receivable',   -- money owed TO Douglas / companies
    'payable',      -- money owed BY Douglas / companies
    'payroll',      -- payroll-related
    'expense',      -- expense claim
    'credit_note'
  )),

  -- Parties
  supplier_name   text,
  supplier_email  text,
  client_name     text,
  client_email    text,

  -- Financials
  currency        text default 'GBP',
  subtotal        numeric(14,2),
  tax_amount      numeric(14,2),
  total_amount    numeric(14,2) not null,
  amount_paid     numeric(14,2) default 0,
  amount_due      numeric(14,2),

  -- Dates
  invoice_date    date,
  due_date        date,
  paid_date       date,

  -- Routing
  project_id      uuid references public.projects(id) on delete set null,
  company_entity  text,                     -- Which Sustain entity this belongs to
  expense_category text,
  vat_applicable  boolean default false,
  tax_year        text,                     -- e.g. "2025-26"

  -- Status
  status          text default 'pending' check (status in (
    'pending','approved','paid','overdue','disputed','cancelled'
  )),
  approval_notes  text,
  approved_at     timestamptz,
  approved_by     text,

  -- AI extraction
  ai_extracted    boolean default false,
  ai_confidence   numeric(3,2),
  raw_text        text,                     -- OCR/extracted text from document

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 4. Filing rules ──────────────────────────────────────────────────────────
-- User-defined routing rules: "if email from X → file in Project Y"
create table if not exists public.filing_rules (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  name          text not null,
  description   text,
  is_active     boolean default true,
  priority      integer default 50,         -- Lower = checked first

  -- Trigger conditions (any match = rule fires)
  trigger_type  text not null check (trigger_type in (
    'email_sender', 'email_subject', 'file_name', 'file_type',
    'ai_category', 'drive_folder', 'keyword'
  )),
  trigger_value text not null,              -- e.g. "ahmed@qiddiya.com"
  trigger_match text default 'contains' check (trigger_match in (
    'exact','contains','starts_with','ends_with','regex'
  )),

  -- Actions
  action_type   text not null check (action_type in (
    'file_to_space',    -- Move/link to a file space
    'tag',              -- Apply a tag
    'create_task',      -- Auto-create a task
    'mark_invoice',     -- Flag as invoice for extraction
    'assign_project',   -- Assign to a project
    'notify'            -- Send notification
  )),
  action_value  text,                       -- e.g. space_id, tag name, project_id

  -- Stats
  times_fired   integer default 0,
  last_fired_at timestamptz,

  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── 5. Drive scan sessions ───────────────────────────────────────────────────
create table if not exists public.drive_scans (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  started_at    timestamptz default now(),
  completed_at  timestamptz,
  status        text default 'running' check (status in ('running','completed','failed','cancelled')),
  files_scanned integer default 0,
  files_classified integer default 0,
  invoices_found integer default 0,
  duplicates_found integer default 0,
  scan_path     text,                       -- Which Drive folder was scanned
  error_message text,
  summary       jsonb default '{}'::jsonb
);

-- ── 6. RLS ───────────────────────────────────────────────────────────────────
alter table public.file_spaces  enable row level security;
alter table public.file_items   enable row level security;
alter table public.invoices     enable row level security;
alter table public.filing_rules enable row level security;
alter table public.drive_scans  enable row level security;

create policy "own_spaces"  on public.file_spaces  for all using (auth.uid() = user_id);
create policy "own_files"   on public.file_items   for all using (auth.uid() = user_id);
create policy "own_invoices" on public.invoices    for all using (auth.uid() = user_id);
create policy "own_rules"   on public.filing_rules for all using (auth.uid() = user_id);
create policy "own_scans"   on public.drive_scans  for all using (auth.uid() = user_id);

-- ── 7. Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_file_spaces_user   on public.file_spaces(user_id, parent_id);
create index if not exists idx_file_items_user    on public.file_items(user_id, filing_status);
create index if not exists idx_file_items_drive   on public.file_items(drive_file_id);
create index if not exists idx_invoices_user      on public.invoices(user_id, status, due_date);
create index if not exists idx_filing_rules_user  on public.filing_rules(user_id, is_active, priority);

-- ── 8. Seed: Default file space structure ────────────────────────────────────
do $$
declare
  v_user_id uuid;
  v_projects_id uuid;
  v_company_id  uuid;
  v_academic_id uuid;
  v_finance_id  uuid;
begin
  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then return; end if;

  -- Root spaces
  insert into public.file_spaces (user_id, name, path, space_type, icon, colour, sort_order) values
    (v_user_id, 'Projects',       '/Projects',       'project',  '🗂️', '#6c8eff', 1) returning id into v_projects_id;
  insert into public.file_spaces (user_id, name, path, space_type, icon, colour, sort_order) values
    (v_user_id, 'Company Group',  '/Company',        'company',  '🏢', '#2dd4a0', 2) returning id into v_company_id;
  insert into public.file_spaces (user_id, name, path, space_type, icon, colour, sort_order) values
    (v_user_id, 'Academic — DBA', '/Academic',       'academic', '🎓', '#a78bfa', 3) returning id into v_academic_id;
  insert into public.file_spaces (user_id, name, path, space_type, icon, colour, sort_order) values
    (v_user_id, 'Finance',        '/Finance',        'folder',   '💰', '#f59e0b', 4) returning id into v_finance_id;
  insert into public.file_spaces (user_id, name, path, space_type, icon, colour, sort_order) values
    (v_user_id, 'Personal',       '/Personal',       'personal', '👤', '#64748b', 5);
  insert into public.file_spaces (user_id, name, path, space_type, icon, colour, sort_order) values
    (v_user_id, 'Archive',        '/Archive',        'archive',  '📦', '#475569', 6);

  -- Project sub-spaces
  insert into public.file_spaces (user_id, name, path, space_type, parent_id, icon, colour, sort_order) values
    (v_user_id, 'Qiddiya — QPMO-410',          '/Projects/Qiddiya',      'project', v_projects_id, '🏗️', '#6c8eff', 1),
    (v_user_id, 'King Salman Park (KSP)',        '/Projects/KSP',          'project', v_projects_id, '🌿', '#22c55e', 2),
    (v_user_id, 'SustainEdge Platform',          '/Projects/SustainEdge',  'project', v_projects_id, '⚡', '#6c8eff', 3),
    (v_user_id, 'InvestiScript Platform',        '/Projects/InvestiScript','project', v_projects_id, '🔍', '#e05a7a', 4),
    (v_user_id, 'PIOS Platform',                 '/Projects/PIOS',         'project', v_projects_id, '◉',  '#a78bfa', 5);

  -- Company sub-spaces
  insert into public.file_spaces (user_id, name, path, space_type, parent_id, icon, colour, sort_order) values
    (v_user_id, 'Sustain International FZE (UAE)', '/Company/Sustain-UAE', 'company', v_company_id, '🇦🇪', '#2dd4a0', 1),
    (v_user_id, 'Sustain International UK Ltd',    '/Company/Sustain-UK',  'company', v_company_id, '🇬🇧', '#2dd4a0', 2),
    (v_user_id, 'VeritasIQ Technologies Ltd',      '/Company/VeritasIQ',   'company', v_company_id, '🔐', '#f59e0b', 3);

  -- Finance sub-spaces
  insert into public.file_spaces (user_id, name, path, space_type, parent_id, icon, colour, sort_order) values
    (v_user_id, 'Invoices — Receivable', '/Finance/Invoices/Receivable', 'folder', v_finance_id, '📥', '#22c55e', 1),
    (v_user_id, 'Invoices — Payable',    '/Finance/Invoices/Payable',    'folder', v_finance_id, '📤', '#f59e0b', 2),
    (v_user_id, 'Payroll',               '/Finance/Payroll',             'folder', v_finance_id, '💳', '#a78bfa', 3),
    (v_user_id, 'Expenses',              '/Finance/Expenses',            'folder', v_finance_id, '🧾', '#e05a7a', 4),
    (v_user_id, 'Tax Records',           '/Finance/Tax',                 'folder', v_finance_id, '🏦', '#64748b', 5);

  -- Academic sub-spaces
  insert into public.file_spaces (user_id, name, path, space_type, parent_id, icon, colour, sort_order) values
    (v_user_id, 'Thesis Chapters',    '/Academic/Thesis',      'folder', v_academic_id, '📝', '#a78bfa', 1),
    (v_user_id, 'Literature',         '/Academic/Literature',  'folder', v_academic_id, '📚', '#6c8eff', 2),
    (v_user_id, 'Research Notes',     '/Academic/Notes',       'folder', v_academic_id, '🗒️', '#22d3ee', 3),
    (v_user_id, 'Supervision',        '/Academic/Supervision', 'folder', v_academic_id, '🎓', '#f59e0b', 4);

  -- Seed default filing rules
  insert into public.filing_rules (user_id, name, trigger_type, trigger_value, trigger_match, action_type, action_value, priority) values
    (v_user_id, 'Invoices → Finance/Payable',   'ai_category', 'invoice',      'exact',    'file_to_space', '/Finance/Invoices/Payable',   10),
    (v_user_id, 'Payroll emails',               'email_subject','payroll',      'contains', 'mark_invoice',  'payroll',                     20),
    (v_user_id, 'Qiddiya emails',               'email_sender', 'qiddiya',      'contains', 'assign_project','Qiddiya — QPMO-410',          30),
    (v_user_id, 'KSP documents',               'file_name',    'KSP',          'contains', 'assign_project','King Salman Park (KSP)',       30),
    (v_user_id, 'SustainEdge files',           'file_name',    'SustainEdge',  'contains', 'assign_project','SustainEdge Platform',         30),
    (v_user_id, 'Expense claims',              'email_subject','expense',      'contains', 'mark_invoice',  'expense',                     40),
    (v_user_id, 'PDF contracts',               'file_type',    'pdf',          'exact',    'ai_category',   'auto',                        50);

end $$;

-- ── 9. Verify ────────────────────────────────────────────────────────────────
select
  (select count(*) from public.file_spaces)  as spaces_seeded,
  (select count(*) from public.filing_rules) as rules_seeded;
`,
  },
  '007': {
    name: "M007: Payroll & expenses",
    sentinel_table: "payroll_entries",
    sql: `-- ============================================================
-- PIOS Migration 007 — Payroll & Expense Workflow
-- Staff management, payroll runs, expense claims, bank transfer queue
-- ============================================================

-- ── 1. Staff / team members ──────────────────────────────────────────────────
create table if not exists public.staff_members (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  full_name       text not null,
  email           text not null,
  role            text,
  company_entity  text,                     -- Which Sustain entity employs them
  employment_type text default 'employee' check (employment_type in (
    'employee','contractor','consultant','director'
  )),
  salary_currency text default 'GBP',
  monthly_salary  numeric(14,2),
  bank_account    text,                     -- Masked: last 4 digits only
  bank_sort_code  text,                     -- Masked
  payment_method  text default 'bank_transfer' check (payment_method in (
    'bank_transfer','cheque','cash','paypal','wise'
  )),
  is_active       boolean default true,
  start_date      date,
  end_date        date,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 2. Payroll runs ───────────────────────────────────────────────────────────
create table if not exists public.payroll_runs (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  pay_period      text not null,            -- e.g. "March 2026"
  pay_date        date,
  status          text default 'draft' check (status in (
    'draft','pending_approval','approved','processing','paid','failed'
  )),
  source          text default 'manual' check (source in (
    'manual','email_detected','accountant_submitted'
  )),
  source_email_id uuid references public.email_items(id) on delete set null,
  total_gross     numeric(14,2),
  total_net       numeric(14,2),
  total_tax       numeric(14,2),
  currency        text default 'GBP',
  company_entity  text,
  notes           text,
  approved_at     timestamptz,
  paid_at         timestamptz,
  -- Chase workflow
  expected_by     date,                     -- When payroll should arrive from accountant
  chase_count     integer default 0,
  last_chased_at  timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 3. Payroll line items (per staff member per run) ─────────────────────────
create table if not exists public.payroll_lines (
  id              uuid primary key default uuid_generate_v4(),
  payroll_run_id  uuid references public.payroll_runs(id) on delete cascade not null,
  staff_member_id uuid references public.staff_members(id) on delete set null,
  user_id         uuid references auth.users(id) on delete cascade not null,
  staff_name      text not null,
  staff_email     text not null,
  gross_pay       numeric(14,2) not null,
  tax_deduction   numeric(14,2) default 0,
  ni_deduction    numeric(14,2) default 0,   -- National Insurance (UK)
  pension         numeric(14,2) default 0,
  other_deductions numeric(14,2) default 0,
  net_pay         numeric(14,2) not null,
  -- Remittance
  remittance_sent boolean default false,
  remittance_sent_at timestamptz,
  bank_transfer_queued boolean default false,
  transfer_reference text,
  created_at      timestamptz default now()
);

-- ── 4. Expense claims ────────────────────────────────────────────────────────
-- Enhanced expense claims with approval workflow
create table if not exists public.expense_claims (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,

  -- Claimant (may be Douglas himself or a staff member)
  claimant_name   text not null,
  claimant_email  text,
  staff_member_id uuid references public.staff_members(id) on delete set null,

  -- Claim details
  claim_period    text,                     -- e.g. "March 2026"
  description     text not null,
  amount          numeric(14,2) not null,
  currency        text default 'GBP',
  category        text check (category in (
    'travel','accommodation','meals','software','hardware','research',
    'professional_fees','training','marketing','utilities','other'
  )),
  domain          text default 'business',
  expense_date    date,

  -- Tax / compliance
  vat_reclaimable boolean default false,
  vat_amount      numeric(14,2),
  tax_year        text,                     -- e.g. "2025-26"
  receipt_url     text,
  receipt_file_id uuid references public.file_items(id) on delete set null,
  invoice_id      uuid references public.invoices(id) on delete set null,

  -- Project / entity routing
  project_id      uuid references public.projects(id) on delete set null,
  company_entity  text,
  billable_to_client boolean default false,
  client_name     text,

  -- Approval workflow
  status          text default 'submitted' check (status in (
    'draft','submitted','approved','rejected','paid','queued_for_payment'
  )),
  submitted_at    timestamptz,
  approved_at     timestamptz,
  approved_by     text,
  rejection_reason text,
  payment_date    date,
  transfer_reference text,
  notes           text,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 5. Bank transfer queue ───────────────────────────────────────────────────
create table if not exists public.transfer_queue (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  transfer_type   text not null check (transfer_type in (
    'payroll','expense_claim','invoice_payment','supplier_payment','other'
  )),
  -- Reference to source
  payroll_line_id uuid references public.payroll_lines(id) on delete set null,
  expense_claim_id uuid references public.expense_claims(id) on delete set null,
  invoice_id      uuid references public.invoices(id) on delete set null,
  -- Payment details
  recipient_name  text not null,
  recipient_email text,
  amount          numeric(14,2) not null,
  currency        text default 'GBP',
  reference       text,                     -- Payment reference
  bank_account    text,                     -- Masked destination
  -- Status
  status          text default 'queued' check (status in (
    'queued','approved','processing','completed','failed','cancelled'
  )),
  approved_at     timestamptz,
  completed_at    timestamptz,
  failure_reason  text,
  -- HITL gate
  requires_approval boolean default true,
  approved_by     text,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 6. Payroll chase log ─────────────────────────────────────────────────────
create table if not exists public.payroll_chase_log (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  payroll_run_id  uuid references public.payroll_runs(id) on delete cascade,
  chase_type      text check (chase_type in ('reminder','escalation','formal_chase','resolved')),
  sent_to         text,
  subject         text,
  message         text,
  sent_at         timestamptz default now()
);

-- ── 7. RLS ───────────────────────────────────────────────────────────────────
alter table public.staff_members    enable row level security;
alter table public.payroll_runs     enable row level security;
alter table public.payroll_lines    enable row level security;
alter table public.expense_claims   enable row level security;
alter table public.transfer_queue   enable row level security;
alter table public.payroll_chase_log enable row level security;

create policy "own_staff"    on public.staff_members    for all using (auth.uid() = user_id);
create policy "own_payroll"  on public.payroll_runs     for all using (auth.uid() = user_id);
create policy "own_p_lines"  on public.payroll_lines    for all using (auth.uid() = user_id);
create policy "own_claims"   on public.expense_claims   for all using (auth.uid() = user_id);
create policy "own_transfers" on public.transfer_queue  for all using (auth.uid() = user_id);
create policy "own_chase"    on public.payroll_chase_log for all using (auth.uid() = user_id);

-- ── 8. Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_staff_user          on public.staff_members(user_id, is_active);
create index if not exists idx_payroll_user        on public.payroll_runs(user_id, status);
create index if not exists idx_payroll_lines_run   on public.payroll_lines(payroll_run_id);
create index if not exists idx_claims_user         on public.expense_claims(user_id, status);
create index if not exists idx_transfers_user      on public.transfer_queue(user_id, status);

-- ── 9. Verify ────────────────────────────────────────────────────────────────
select
  (select count(*) from public.staff_members)   as staff,
  (select count(*) from public.payroll_runs)     as payroll_runs,
  (select count(*) from public.expense_claims)   as expense_claims,
  (select count(*) from public.transfer_queue)   as transfers;
`,
  },

  '008': {
    name: 'M008: user_profiles — primary_project & consulting_context',
    sentinel_table: 'user_profiles',
    sql: `-- M008: Professional context fields on user_profiles
alter table public.user_profiles
  add column if not exists primary_project     text,
  add column if not exists consulting_context  text,
  add column if not exists billing_email       text;

update public.user_profiles
set
  primary_project    = 'King Salman Park (SAR 229.6M)',
  consulting_context = 'GCC FM consultancy — King Salman Park (KSP-001), Qiddiya (QPMO-410-CT-07922). VeritasEdge platform.',
  updated_at         = now()
where id = '47621611-96bc-465c-913e-0d23a89465f5';
`,
  },

  '009': {
    name: 'M009: user_profiles — deployment_mode, active_modules, it_policy_acknowledged',
    sentinel_table: 'user_profiles',
    sql: `-- ============================================================
-- PIOS Migration 009 — Onboarding completion columns
-- deployment_mode, active_modules, it_policy_acknowledged
-- Written by /api/onboarding/complete but missing from schema
-- ============================================================
alter table public.user_profiles
  add column if not exists deployment_mode          text default 'full',
  add column if not exists active_modules           text[] default '{}',
  add column if not exists it_policy_acknowledged   boolean default false,
  add column if not exists persona_display          text;

select column_name FROM information_schema.columns
where table_name = 'user_profiles'
  and column_name in ('deployment_mode','active_modules','it_policy_acknowledged');
`,
  },

  '010': {
    name: 'M010: Missing tables — coaching, day_plans, financial_snapshots, user_feed_settings, supervision, vault_folders, cpd, consulting, commitments, exec_modules',
    sentinel_table: 'coaching_sessions',
    sql: `-- ============================================================
-- PIOS Migration 010 — Missing tables for core platform features
-- ============================================================

-- Coaching
create table if not exists public.coaching_sessions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  session_type text default 'general',
  prompt      text,
  response    text,
  created_at  timestamptz default now()
);
create table if not exists public.coaching_profile (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null unique,
  style       text default 'direct',
  focus_areas text[],
  updated_at  timestamptz default now()
);
create table if not exists public.insights (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  content     text,
  source      text,
  tags        text[],
  created_at  timestamptz default now()
);

-- PA / Day planning
create table if not exists public.day_plans (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  plan_date   date not null,
  content     text,
  priorities  text[],
  created_at  timestamptz default now()
);
create table if not exists public.commitments (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  due_date    date,
  status      text default 'open',
  created_at  timestamptz default now()
);

-- Financial snapshots
create table if not exists public.financial_snapshots (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  period      text,
  revenue     numeric(14,2) default 0,
  burn        numeric(14,2) default 0,
  runway_days integer,
  notes       text,
  created_at  timestamptz default now()
);

-- Feed settings
create table if not exists public.user_feed_settings (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null unique,
  settings    jsonb default '{}',
  updated_at  timestamptz default now()
);
create table if not exists public.user_feed_topics (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  topic       text not null,
  enabled     boolean default true
);
create table if not exists public.intelligence_prefs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null unique,
  prefs       jsonb default '{}',
  updated_at  timestamptz default now()
);

-- Academic / supervision
create table if not exists public.supervision_sessions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  session_date    date,
  supervisor      text,
  notes           text,
  action_items    text[],
  created_at      timestamptz default now()
);
create table if not exists public.database_searches (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  query       text,
  results     jsonb,
  created_at  timestamptz default now()
);
create table if not exists public.dba_milestones (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  due_date    date,
  status      text default 'pending',
  created_at  timestamptz default now()
);
create table if not exists public.learning_journeys (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  description text,
  created_at  timestamptz default now()
);
create table if not exists public.learning_journal_entries (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  journey_id  uuid references public.learning_journeys(id) on delete cascade,
  content     text,
  created_at  timestamptz default now()
);
create table if not exists public.cpd_activities (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  hours       numeric(6,2) default 0,
  date        date,
  body_id     uuid,
  created_at  timestamptz default now()
);
create table if not exists public.cpd_bodies (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  annual_hours numeric(6,2) default 0,
  created_at  timestamptz default now()
);
create table if not exists public.purpose_anchors (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  content     text not null,
  anchor_type text default 'purpose',
  created_at  timestamptz default now()
);

-- Vault
create table if not exists public.vault_document_folders (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  parent_id   uuid,
  created_at  timestamptz default now()
);

-- Consulting
create table if not exists public.consulting_engagements (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  client_name text not null,
  title       text,
  status      text default 'active',
  start_date  date,
  end_date    date,
  created_at  timestamptz default now()
);

-- Exec modules
create table if not exists public.exec_principles (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  content     text,
  created_at  timestamptz default now()
);
create table if not exists public.exec_reviews (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  review_date date,
  content     text,
  created_at  timestamptz default now()
);
create table if not exists public.exec_time_blocks (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  block_type  text,
  duration_mins integer,
  created_at  timestamptz default now()
);
create table if not exists public.exec_time_audits (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  audit_date  date,
  data        jsonb,
  created_at  timestamptz default now()
);
create table if not exists public.exec_decisions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  status      text default 'open',
  context     text,
  created_at  timestamptz default now()
);
create table if not exists public.exec_decision_analyses (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  decision_id uuid,
  analysis    text,
  created_at  timestamptz default now()
);
create table if not exists public.exec_okrs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  progress    integer default 0,
  created_at  timestamptz default now()
);
create table if not exists public.exec_stakeholders (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  relationship text,
  created_at  timestamptz default now()
);

-- Operator / Chief of Staff
create table if not exists public.operator_configs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null unique,
  config      jsonb default '{}',
  updated_at  timestamptz default now()
);
create table if not exists public.okr_notification_prefs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null unique,
  prefs       jsonb default '{}',
  updated_at  timestamptz default now()
);
create table if not exists public.market_intelligence (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  content     text,
  source      text,
  created_at  timestamptz default now()
);
create table if not exists public.strategic_reviews (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  review_date date,
  content     text,
  created_at  timestamptz default now()
);
create table if not exists public.portfolio_workstreams (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  status      text default 'active',
  created_at  timestamptz default now()
);

-- Content
create table if not exists public.content_publish_log (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  episode_id  uuid,
  platform    text,
  status      text default 'published',
  created_at  timestamptz default now()
);
create table if not exists public.content_review_jobs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  episode_id  uuid,
  status      text default 'pending',
  feedback    text,
  created_at  timestamptz default now()
);

-- SIA / BICA
create table if not exists public.sia_signal_briefs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  content     text,
  signal_date date,
  created_at  timestamptz default now()
);
create table if not exists public.bica_comms (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  content     text,
  comm_type   text,
  created_at  timestamptz default now()
);

-- Email
create table if not exists public.attachment_queue (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  email_id    uuid,
  filename    text,
  status      text default 'pending',
  created_at  timestamptz default now()
);

-- Files
create table if not exists public.file_spaces (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  created_at  timestamptz default now()
);
create table if not exists public.file_items (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  space_id    uuid references public.file_spaces(id) on delete cascade,
  name        text not null,
  path        text,
  created_at  timestamptz default now()
);
create table if not exists public.filing_rules (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  rule        text not null,
  action      text,
  created_at  timestamptz default now()
);
create table if not exists public.drive_scans (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  scan_date   timestamptz default now(),
  items_found integer default 0,
  status      text default 'complete'
);
create table if not exists public.invoices (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  amount      numeric(14,2),
  currency    text default 'GBP',
  status      text default 'draft',
  created_at  timestamptz default now()
);

-- Payroll
create table if not exists public.payroll_chase_log (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  staff_id    uuid,
  chased_at   timestamptz default now(),
  notes       text
);

-- Meeting notes
create table if not exists public.meeting_notes (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  meeting_id  uuid,
  content     text,
  created_at  timestamptz default now()
);

-- Knowledge
create table if not exists public.knowledge_entries (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  content     text,
  tags        text[],
  created_at  timestamptz default now()
);

-- AI
create table if not exists public.ai_credits_resets (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  reset_at    timestamptz default now(),
  credits     integer
);
create table if not exists public.ai_credits (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null unique,
  used        integer default 0,
  limit_val   integer default 50,
  updated_at  timestamptz default now()
);

-- Programme milestones (DBA)
create table if not exists public.programme_milestones (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  due_date    date,
  status      text default 'pending',
  created_at  timestamptz default now()
);

-- Thesis snapshots
create table if not exists public.thesis_weekly_snapshots (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  snapshot_date   date,
  word_count      integer,
  chapters_done   integer,
  notes           text,
  created_at      timestamptz default now()
);

-- Executive decisions / OKRs (PA module)
create table if not exists public.executive_decisions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  status      text default 'open',
  created_at  timestamptz default now()
);
create table if not exists public.executive_okrs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  progress    integer default 0,
  created_at  timestamptz default now()
);

-- Staleness alerts (PA)
create table if not exists public.staleness_alerts (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  entity_type text,
  entity_id   uuid,
  alerted_at  timestamptz default now()
);

-- Organisations (shared ref)
create table if not exists public.organisations (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  type        text,
  created_at  timestamptz default now()
);

-- RLS: enable on all new tables (owner can only see own rows)
do $$ declare t text; begin
  foreach t in array array[
    'coaching_sessions','coaching_profile','insights','day_plans','commitments',
    'financial_snapshots','user_feed_settings','user_feed_topics','intelligence_prefs',
    'supervision_sessions','database_searches','dba_milestones','learning_journeys',
    'learning_journal_entries','cpd_activities','cpd_bodies','purpose_anchors',
    'vault_document_folders','consulting_engagements','exec_principles','exec_reviews',
    'exec_time_blocks','exec_time_audits','exec_decisions','exec_decision_analyses',
    'exec_okrs','exec_stakeholders','operator_configs','okr_notification_prefs',
    'market_intelligence','strategic_reviews','portfolio_workstreams',
    'content_publish_log','content_review_jobs','sia_signal_briefs','bica_comms',
    'attachment_queue','file_spaces','file_items','filing_rules','drive_scans',
    'invoices','payroll_chase_log','meeting_notes','knowledge_entries',
    'ai_credits_resets','ai_credits','programme_milestones','thesis_weekly_snapshots',
    'executive_decisions','executive_okrs','staleness_alerts'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy if not exists "%s_own" on public.%I for all using (user_id = auth.uid())', t, t
    );
  end loop;
end $$;

select count(*) as new_tables_created from information_schema.tables
where table_schema = 'public'
  and table_name in ('coaching_sessions','day_plans','financial_snapshots','user_feed_settings','cpd_activities');
`,
  },

  '011': {
    name: 'M011: contracts table + okr_notification_prefs columns',
    sentinel_table: 'contracts',
    sql: `-- ============================================================
-- PIOS Migration 011 — Contracts + OKR prefs
-- ============================================================
create table if not exists public.contracts (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid references auth.users(id) on delete cascade not null,
  tenant_id           uuid references public.tenants(id) on delete cascade,
  title               text not null,
  contract_type       text default 'service',
  counterparty        text,
  status              text default 'active',
  value               numeric(14,2),
  currency            text default 'GBP',
  start_date          date,
  end_date            date,
  auto_renewal        boolean default false,
  notice_period_days  integer default 30,
  key_terms           text,
  obligations         text,
  file_url            text,
  notes               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
alter table public.contracts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='contracts' and policyname='contracts_own') then
    create policy contracts_own on public.contracts for all using (user_id = auth.uid());
  end if;
end $$;
create index if not exists idx_contracts_user on public.contracts(user_id, status);

alter table public.okr_notification_prefs
  add column if not exists email_address  text,
  add column if not exists weekly_digest  boolean default false,
  add column if not exists digest_enabled boolean default true;

select count(*) as contracts from public.contracts;
`,
  },

  '012': {
    name: 'M012: okrs, decisions, exec_key_results + financial_snapshots columns',
    sentinel_table: 'okrs',
    sql: `-- M012: Core tables for briefs, dashboard, and seed data
create table if not exists public.okrs (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  tenant_id    uuid references public.tenants(id) on delete cascade,
  title        text not null,
  description  text,
  period       text,
  status       text default 'active',
  health       text default 'on_track',
  progress_pct integer default 0,
  owner        text,
  due_date     date,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
alter table public.okrs enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='okrs' and policyname='okrs_own') then
    create policy okrs_own on public.okrs for all using (user_id = auth.uid());
  end if;
end $$;
create index if not exists idx_okrs_user on public.okrs(user_id, status);

create table if not exists public.key_results (
  id           uuid primary key default uuid_generate_v4(),
  okr_id       uuid references public.okrs(id) on delete cascade not null,
  user_id      uuid references auth.users(id) on delete cascade not null,
  title        text not null,
  current_val  numeric default 0,
  target_val   numeric default 100,
  unit         text,
  progress_pct integer default 0,
  created_at   timestamptz default now()
);
alter table public.key_results enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='key_results' and policyname='key_results_own') then
    create policy key_results_own on public.key_results for all using (user_id = auth.uid());
  end if;
end $$;

create table if not exists public.exec_key_results (
  id           uuid primary key default uuid_generate_v4(),
  okr_id       uuid references public.exec_okrs(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade not null,
  title        text not null,
  current_val  numeric default 0,
  target_val   numeric default 100,
  unit         text,
  progress_pct integer default 0,
  created_at   timestamptz default now()
);
alter table public.exec_key_results enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='exec_key_results' and policyname='exec_key_results_own') then
    create policy exec_key_results_own on public.exec_key_results for all using (user_id = auth.uid());
  end if;
end $$;

create table if not exists public.decisions (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  tenant_id    uuid references public.tenants(id) on delete cascade,
  title        text not null,
  context      text,
  options      text,
  rationale    text,
  status       text default 'open',
  domain       text,
  decided_at   timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
alter table public.decisions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='decisions' and policyname='decisions_own') then
    create policy decisions_own on public.decisions for all using (user_id = auth.uid());
  end if;
end $$;
create index if not exists idx_decisions_user on public.decisions(user_id, status);

alter table public.financial_snapshots
  add column if not exists revenue_gbp   numeric(14,2) default 0,
  add column if not exists burn_gbp      numeric(14,2) default 0,
  add column if not exists runway_months numeric(6,1),
  add column if not exists entity        text default 'group',
  add column if not exists expenses      numeric(14,2) default 0;

select (select count(*) from public.okrs) as okrs,
       (select count(*) from public.decisions) as decisions;
`,
  },

  '010': {
    name: 'M010: Missing tables — coaching, day_plans, financial_snapshots, user_feed_settings, supervision, vault_folders, cpd, consulting, commitments, exec_modules',
    sentinel_table: 'coaching_sessions',
    sql: `-- ============================================================
-- PIOS Migration 010 — Missing tables for core platform features
-- ============================================================

-- Coaching
create table if not exists public.coaching_sessions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  session_type text default 'general',
  prompt      text,
  response    text,
  created_at  timestamptz default now()
);
create table if not exists public.coaching_profile (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null unique,
  style       text default 'direct',
  focus_areas text[],
  updated_at  timestamptz default now()
);
create table if not exists public.insights (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  content     text,
  source      text,
  tags        text[],
  created_at  timestamptz default now()
);

-- PA / Day planning
create table if not exists public.day_plans (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  plan_date   date not null,
  content     text,
  priorities  text[],
  created_at  timestamptz default now()
);
create table if not exists public.commitments (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  due_date    date,
  status      text default 'open',
  created_at  timestamptz default now()
);

-- Financial snapshots
create table if not exists public.financial_snapshots (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  period      text,
  revenue     numeric(14,2) default 0,
  burn        numeric(14,2) default 0,
  runway_days integer,
  notes       text,
  created_at  timestamptz default now()
);

-- Feed settings
create table if not exists public.user_feed_settings (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null unique,
  settings    jsonb default '{}',
  updated_at  timestamptz default now()
);
create table if not exists public.user_feed_topics (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  topic       text not null,
  enabled     boolean default true
);
create table if not exists public.intelligence_prefs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null unique,
  prefs       jsonb default '{}',
  updated_at  timestamptz default now()
);

-- Academic / supervision
create table if not exists public.supervision_sessions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  session_date    date,
  supervisor      text,
  notes           text,
  action_items    text[],
  created_at      timestamptz default now()
);
create table if not exists public.database_searches (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  query       text,
  results     jsonb,
  created_at  timestamptz default now()
);
create table if not exists public.dba_milestones (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  due_date    date,
  status      text default 'pending',
  created_at  timestamptz default now()
);
create table if not exists public.learning_journeys (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  description text,
  created_at  timestamptz default now()
);
create table if not exists public.learning_journal_entries (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  journey_id  uuid references public.learning_journeys(id) on delete cascade,
  content     text,
  created_at  timestamptz default now()
);
create table if not exists public.cpd_activities (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  hours       numeric(6,2) default 0,
  date        date,
  body_id     uuid,
  created_at  timestamptz default now()
);
create table if not exists public.cpd_bodies (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  annual_hours numeric(6,2) default 0,
  created_at  timestamptz default now()
);
create table if not exists public.purpose_anchors (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  content     text not null,
  anchor_type text default 'purpose',
  created_at  timestamptz default now()
);

-- Vault
create table if not exists public.vault_document_folders (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  parent_id   uuid,
  created_at  timestamptz default now()
);

-- Consulting
create table if not exists public.consulting_engagements (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  client_name text not null,
  title       text,
  status      text default 'active',
  start_date  date,
  end_date    date,
  created_at  timestamptz default now()
);

-- Exec modules
create table if not exists public.exec_principles (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  content     text,
  created_at  timestamptz default now()
);
create table if not exists public.exec_reviews (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  review_date date,
  content     text,
  created_at  timestamptz default now()
);
create table if not exists public.exec_time_blocks (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  block_type  text,
  duration_mins integer,
  created_at  timestamptz default now()
);
create table if not exists public.exec_time_audits (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  audit_date  date,
  data        jsonb,
  created_at  timestamptz default now()
);
create table if not exists public.exec_decisions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  status      text default 'open',
  context     text,
  created_at  timestamptz default now()
);
create table if not exists public.exec_decision_analyses (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  decision_id uuid,
  analysis    text,
  created_at  timestamptz default now()
);
create table if not exists public.exec_okrs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  progress    integer default 0,
  created_at  timestamptz default now()
);
create table if not exists public.exec_stakeholders (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  relationship text,
  created_at  timestamptz default now()
);

-- Operator / Chief of Staff
create table if not exists public.operator_configs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null unique,
  config      jsonb default '{}',
  updated_at  timestamptz default now()
);
create table if not exists public.okr_notification_prefs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null unique,
  prefs       jsonb default '{}',
  updated_at  timestamptz default now()
);
create table if not exists public.market_intelligence (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  content     text,
  source      text,
  created_at  timestamptz default now()
);
create table if not exists public.strategic_reviews (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  review_date date,
  content     text,
  created_at  timestamptz default now()
);
create table if not exists public.portfolio_workstreams (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  status      text default 'active',
  created_at  timestamptz default now()
);

-- Content
create table if not exists public.content_publish_log (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  episode_id  uuid,
  platform    text,
  status      text default 'published',
  created_at  timestamptz default now()
);
create table if not exists public.content_review_jobs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  episode_id  uuid,
  status      text default 'pending',
  feedback    text,
  created_at  timestamptz default now()
);

-- SIA / BICA
create table if not exists public.sia_signal_briefs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  content     text,
  signal_date date,
  created_at  timestamptz default now()
);
create table if not exists public.bica_comms (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  content     text,
  comm_type   text,
  created_at  timestamptz default now()
);

-- Email
create table if not exists public.attachment_queue (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  email_id    uuid,
  filename    text,
  status      text default 'pending',
  created_at  timestamptz default now()
);

-- Files
create table if not exists public.file_spaces (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  created_at  timestamptz default now()
);
create table if not exists public.file_items (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  space_id    uuid references public.file_spaces(id) on delete cascade,
  name        text not null,
  path        text,
  created_at  timestamptz default now()
);
create table if not exists public.filing_rules (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  rule        text not null,
  action      text,
  created_at  timestamptz default now()
);
create table if not exists public.drive_scans (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  scan_date   timestamptz default now(),
  items_found integer default 0,
  status      text default 'complete'
);
create table if not exists public.invoices (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  amount      numeric(14,2),
  currency    text default 'GBP',
  status      text default 'draft',
  created_at  timestamptz default now()
);

-- Payroll
create table if not exists public.payroll_chase_log (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  staff_id    uuid,
  chased_at   timestamptz default now(),
  notes       text
);

-- Meeting notes
create table if not exists public.meeting_notes (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  meeting_id  uuid,
  content     text,
  created_at  timestamptz default now()
);

-- Knowledge
create table if not exists public.knowledge_entries (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  content     text,
  tags        text[],
  created_at  timestamptz default now()
);

-- AI
create table if not exists public.ai_credits_resets (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  reset_at    timestamptz default now(),
  credits     integer
);
create table if not exists public.ai_credits (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null unique,
  used        integer default 0,
  limit_val   integer default 50,
  updated_at  timestamptz default now()
);

-- Programme milestones (DBA)
create table if not exists public.programme_milestones (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  due_date    date,
  status      text default 'pending',
  created_at  timestamptz default now()
);

-- Thesis snapshots
create table if not exists public.thesis_weekly_snapshots (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  snapshot_date   date,
  word_count      integer,
  chapters_done   integer,
  notes           text,
  created_at      timestamptz default now()
);

-- Executive decisions / OKRs (PA module)
create table if not exists public.executive_decisions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  status      text default 'open',
  created_at  timestamptz default now()
);
create table if not exists public.executive_okrs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  progress    integer default 0,
  created_at  timestamptz default now()
);

-- Staleness alerts (PA)
create table if not exists public.staleness_alerts (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  entity_type text,
  entity_id   uuid,
  alerted_at  timestamptz default now()
);

-- Organisations (shared ref)
create table if not exists public.organisations (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  type        text,
  created_at  timestamptz default now()
);

-- RLS: enable on all new tables (owner can only see own rows)
do $$ declare t text; begin
  foreach t in array array[
    'coaching_sessions','coaching_profile','insights','day_plans','commitments',
    'financial_snapshots','user_feed_settings','user_feed_topics','intelligence_prefs',
    'supervision_sessions','database_searches','dba_milestones','learning_journeys',
    'learning_journal_entries','cpd_activities','cpd_bodies','purpose_anchors',
    'vault_document_folders','consulting_engagements','exec_principles','exec_reviews',
    'exec_time_blocks','exec_time_audits','exec_decisions','exec_decision_analyses',
    'exec_okrs','exec_stakeholders','operator_configs','okr_notification_prefs',
    'market_intelligence','strategic_reviews','portfolio_workstreams',
    'content_publish_log','content_review_jobs','sia_signal_briefs','bica_comms',
    'attachment_queue','file_spaces','file_items','filing_rules','drive_scans',
    'invoices','payroll_chase_log','meeting_notes','knowledge_entries',
    'ai_credits_resets','ai_credits','programme_milestones','thesis_weekly_snapshots',
    'executive_decisions','executive_okrs','staleness_alerts'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy if not exists "%s_own" on public.%I for all using (user_id = auth.uid())', t, t
    );
  end loop;
end $$;

select count(*) as new_tables_created from information_schema.tables
where table_schema = 'public'
  and table_name in ('coaching_sessions','day_plans','financial_snapshots','user_feed_settings','cpd_activities');
`,
  },

async function checkTableExists(supabase: any, tableName: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(tableName).select('id').limit(1)
    return !error
  } catch {
    return false
  }
}

async function runPg(sql: string): Promise<{ ok: boolean; err?: string }> {
  const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? ''
  if (!dbUrl) return { ok: false, err: 'No DATABASE_URL / SUPABASE_DB_URL / DIRECT_URL env var set' }
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    await client.query(sql)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, err: e.message }
  } finally {
    await client.end()
  }
}

export async function GET() {
  try {
    const supabase = createServiceClient()
    const status: Record<string, { applied: boolean; name: string }> = {}
    for (const [id, m] of Object.entries(MIGRATIONS)) {
      const applied = await checkTableExists(supabase, m.sentinel_table)
      status[id] = { applied: id === '002' ? false : applied, name: m.name }
    }
    return NextResponse.json({ status, migrations: Object.keys(MIGRATIONS) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const bodyRaw = await request.text()
    const body = JSON.parse(bodyRaw || '{}')
    const { migration, run_all } = body

    const supabase = createServiceClient()

    if (run_all) {
      const results: unknown[] = []
      for (const id of Object.keys(MIGRATIONS)) {
        const m = MIGRATIONS[id]
        // Skip sentinel check for 002 (dedup — always safe to re-run)
        const already = id !== '002' && await checkTableExists(supabase, m.sentinel_table)
        if (already) {
          results.push({ id, name: m.name, status: 'skipped', reason: 'Already applied' })
          continue
        }
        const r = await runPg(m.sql)
        results.push({ id, name: m.name, status: r.ok ? 'applied' : 'error', error: r.err })
      }
      return NextResponse.json({ results })
    }

    const m = MIGRATIONS[migration]
    if (!m) return NextResponse.json({ error: `Unknown migration: ${migration}` }, { status: 400 })

    const r = await runPg(m.sql)
    if (!r.ok) return NextResponse.json({ error: r.err, migration }, { status: 500 })
    return NextResponse.json({ success: true, status: 'applied', migration, name: m.name })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
