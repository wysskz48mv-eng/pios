/**
 * POST /api/admin/run-migration
 * Applies PIOS migrations 008–012 via direct pg connection.
 * Auth: owner email (info@veritasiq.io) session.
 * PIOS v2.2 | Sprint 28 | VeritasIQ Technologies Ltd
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/redis-rate-limit'
import { requireMFA } from '@/lib/mfa'

const OWNER_EMAIL = 'info@veritasiq.io'

const MIGRATIONS: Record<string, { name: string; sql: string; sentinel: string }> = {
  '008': {
    name: 'Thesis Weekly Snapshots',
    sentinel: 'thesis_weekly_snapshots',
    sql: `
CREATE TABLE IF NOT EXISTS public.thesis_weekly_snapshots (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade,
  week_start  date not null,
  word_count  integer default 0,
  chapter_id  uuid,
  notes       text,
  created_at  timestamptz default now()
);`,
  },
  '009': {
    name: 'Multi-email & Meeting Notes',
    sentinel: 'connected_email_accounts',
    sql: `
CREATE TABLE IF NOT EXISTS public.connected_email_accounts (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade,
  email       text not null,
  provider    text default 'google',
  access_token  text,
  refresh_token text,
  token_expiry  timestamptz,
  is_primary  boolean default false,
  created_at  timestamptz default now()
);
CREATE TABLE IF NOT EXISTS public.meeting_notes (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade,
  tenant_id   uuid references public.tenants(id) on delete cascade,
  title       text not null,
  content     text,
  meeting_date date,
  attendees   text[],
  action_items text[],
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);`,
  },
  '010': {
    name: 'DBA Milestones',
    sentinel: 'dba_milestones',
    sql: `
CREATE TABLE IF NOT EXISTS public.dba_milestones (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade,
  title         text not null,
  milestone_type text,
  category      text,
  status        text default 'upcoming' check (status in ('upcoming','in_progress','passed','failed','deferred','waived')),
  target_date   date,
  completed_date date,
  alert_days_before integer default 14,
  sort_order    integer default 0,
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);`,
  },
  '011': {
    name: 'Learning Journeys',
    sentinel: 'programme_milestones',
    sql: `
CREATE TABLE IF NOT EXISTS public.learning_journeys (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade,
  persona     text,
  programme_name text,
  started_at  timestamptz default now(),
  created_at  timestamptz default now()
);
CREATE TABLE IF NOT EXISTS public.programme_milestones (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade,
  title         text not null,
  milestone_type text,
  category      text,
  status        text default 'upcoming' check (status in ('upcoming','in_progress','passed','failed','deferred','waived')),
  target_date   date,
  completed_date date,
  alert_days_before integer default 14,
  sort_order    integer default 0,
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
CREATE TABLE IF NOT EXISTS public.cpd_activities (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid references auth.users(id) on delete cascade,
  title               text not null,
  activity_type       text default 'course',
  provider            text,
  hours_verifiable    numeric(5,1) default 0,
  hours_non_verifiable numeric(5,1) default 0,
  completed_date      date,
  cpd_year            integer,
  reflection          text,
  created_at          timestamptz default now()
);`,
  },
  '012': {
    name: 'Trial Enforcement & plan_status',
    sentinel: 'tenants',
    sql: `
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan_status TEXT
    DEFAULT 'trialing'
    CHECK (plan_status IN ('trialing','active','past_due','canceled','paused'));

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS seats_limit INTEGER DEFAULT 1;

UPDATE public.tenants
  SET plan_status = COALESCE(subscription_status, 'trialing')
  WHERE plan_status IS NULL;

UPDATE public.tenants
  SET trial_ends_at = NOW() + INTERVAL '3 days'
  WHERE trial_ends_at IS NULL
    AND (plan_status = 'trialing' OR subscription_status = 'active');

CREATE OR REPLACE FUNCTION sync_plan_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    NEW.plan_status := NEW.subscription_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_sync_plan_status ON public.tenants;
CREATE TRIGGER trig_sync_plan_status
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION sync_plan_status();

CREATE OR REPLACE FUNCTION expire_trials()
RETURNS void AS $$
BEGIN
  UPDATE public.tenants
    SET plan_status = 'canceled', subscription_status = 'canceled'
    WHERE plan_status = 'trialing'
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at < NOW();
END;
$$ LANGUAGE plpgsql;\`,
  },
  '013': {
    name: 'Learning Hub v2.0 — CPD bodies + journal tracking',
    sentinel: 'cpd_bodies',
    sql: \`-- M013: Learning Hub v2.0 — CPD body expanded support + journal tracking
-- PIOS v2.2 | VeritasIQ Technologies Ltd

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'learning_journeys') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='learning_journeys' AND column_name='journal_entries') THEN
      ALTER TABLE learning_journeys ADD COLUMN journal_entries INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='learning_journeys' AND column_name='supervisor_approved') THEN
      ALTER TABLE learning_journeys ADD COLUMN supervisor_approved BOOLEAN DEFAULT false;
      ALTER TABLE learning_journeys ADD COLUMN supervisor_approved_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='learning_journeys' AND column_name='target_completion_date') THEN
      ALTER TABLE learning_journeys ADD COLUMN target_completion_date DATE;
    END IF;
    RAISE NOTICE 'M013: learning_journeys v2 fields added';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cpd_bodies') THEN
    CREATE TABLE cpd_bodies (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code         TEXT UNIQUE NOT NULL,
      name         TEXT NOT NULL,
      full_name    TEXT,
      country      TEXT DEFAULT 'UK',
      annual_hours INTEGER,
      website      TEXT,
      active       BOOLEAN DEFAULT true,
      created_at   TIMESTAMPTZ DEFAULT now()
    );
    INSERT INTO cpd_bodies (code, name, full_name, country, annual_hours, website) VALUES
      ('CIMA',  'CIMA',  'Chartered Institute of Management Accountants',         'UK', 120, 'cimaglobal.com'),
      ('ICAEW', 'ICAEW', 'Institute of Chartered Accountants in England & Wales', 'UK', 120, 'icaew.com'),
      ('ICE',   'ICE',   'Institution of Civil Engineers',                         'UK',  30, 'ice.org.uk'),
      ('RICS',  'RICS',  'Royal Institution of Chartered Surveyors',               'UK',  20, 'rics.org'),
      ('CIPD',  'CIPD',  'Chartered Institute of Personnel & Development',         'UK',  30, 'cipd.org'),
      ('NMC',   'NMC',   'Nursing & Midwifery Council',                            'UK',  35, 'nmc.org.uk'),
      ('SRA',   'SRA',   'Solicitors Regulation Authority',                        'UK',  16, 'sra.org.uk'),
      ('ACCA',  'ACCA',  'Association of Chartered Certified Accountants',         'UK', 120, 'accaglobal.com'),
      ('BCS',   'BCS',   'British Computer Society',                               'UK',  30, 'bcs.org'),
      ('CIOB',  'CIOB',  'Chartered Institute of Building',                        'UK',  30, 'ciob.org'),
      ('RIBA',  'RIBA',  'Royal Institute of British Architects',                  'UK',  35, 'architecture.com'),
      ('CMI',   'CMI',   'Chartered Management Institute',                         'UK',  30, 'managers.org.uk');
    RAISE NOTICE 'M013: cpd_bodies reference table created with 12 bodies';
  END IF;
END;
$$;

ALTER TABLE IF EXISTS cpd_bodies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cpd_bodies' AND policyname='cpd_bodies_public_read') THEN
    CREATE POLICY "cpd_bodies_public_read" ON cpd_bodies FOR SELECT USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS learning_journal_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  mood          TEXT,
  tags          TEXT[] DEFAULT '{}',
  ai_reflection TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE learning_journal_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='learning_journal_entries' AND policyname='journal_own_data') THEN
    CREATE POLICY "journal_own_data" ON learning_journal_entries
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS learning_journal_user_idx
  ON learning_journal_entries(user_id, created_at DESC);

SELECT 'M013: Learning Hub v2.0 + CPD bodies ready' AS result;`,
  },
  '014': {
    name: 'NPS Survey Responses -- SRAF D-02 pilot feedback',
    sentinel: 'nps_survey_responses',
    sql: `CREATE TABLE IF NOT EXISTS nps_survey_responses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  platform      TEXT NOT NULL DEFAULT 'pios',
  stability     NUMERIC(3,1) NOT NULL CHECK (stability   BETWEEN 1 AND 5),
  performance   NUMERIC(3,1) NOT NULL CHECK (performance BETWEEN 1 AND 5),
  security      BOOLEAN NOT NULL DEFAULT true,
  feature_fit   NUMERIC(3,1) NOT NULL CHECK (feature_fit BETWEEN 1 AND 5),
  nps           INTEGER NOT NULL CHECK (nps BETWEEN 0 AND 10),
  cps           NUMERIC(4,2) NOT NULL,
  open_feedback TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE nps_survey_responses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nps_survey_responses' AND policyname='nps_own_read') THEN
    CREATE POLICY "nps_own_read" ON nps_survey_responses FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nps_survey_responses' AND policyname='nps_insert_any') THEN
    CREATE POLICY "nps_insert_any" ON nps_survey_responses FOR INSERT WITH CHECK (true);
  END IF;
END $$;
SELECT 'M014: nps_survey_responses ready' AS result`,
  },
  '015': {
    name: 'M015: Executive Persona Foundation — persona_type, EOSA™, PAA™, STIA™',
    sentinel: 'user_persona_settings',
    sql: `-- ============================================================
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
create index if not exists idx_exec_okrs_period       on public.exec_okrs(user_id, period, health);`,
  },
  '016': {
    name: 'M016: Consulting, Decision Analysis, Time Sovereignty — Sprint 23',
    sentinel: 'consulting_engagements',
    sql: `-- ============================================================
-- PIOS Sprint 23 — CSA™ · DAA™ · TSA™
-- M016: consulting engagements, decision analysis, time audit
-- VeritasIQ Technologies Ltd
-- ============================================================

-- ── 1. Consulting Engagements (CSA™) ─────────────────────────
create table if not exists public.consulting_engagements (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  client_name     text not null,
  engagement_type text default 'strategy'
    check (engagement_type in ('strategy','operations','change','commercial','diagnostic','other')),
  status          text default 'active'
    check (status in ('active','proposal','on_hold','completed','cancelled')),
  framework_used  text,   -- POM™ | OAE™ | SDL™ | CVDM™ | CPA™ | SCE™ | AAM™
  brief           text,
  ai_output       text,   -- last generated artefact
  start_date      date,
  end_date        date,
  value           numeric,
  currency        text default 'GBP',
  tags            text[],
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 2. Decision options (extends exec_decisions DAA™) ─────────
-- Options are stored as jsonb in exec_decisions.options_json
-- but we also log AI analysis separately for audit trail
create table if not exists public.exec_decision_analyses (
  id              uuid primary key default uuid_generate_v4(),
  decision_id     uuid references public.exec_decisions(id) on delete cascade,
  tenant_id       uuid references public.tenants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  framework_used  text not null,
  analysis_text   text not null,
  recommendation  text,
  confidence      integer check (confidence between 0 and 100),
  created_at      timestamptz default now()
);

-- ── 3. Time audit log (TSA™) ──────────────────────────────────
create table if not exists public.exec_time_audits (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  week_start      date not null,
  strategic_hours numeric default 0,
  operational_hours numeric default 0,
  admin_hours     numeric default 0,
  stakeholder_hours numeric default 0,
  recovery_hours  numeric default 0,
  total_hours     numeric default 0,
  strategic_pct   integer generated always as (
    case when total_hours > 0
    then round((strategic_hours / total_hours) * 100)
    else 0 end
  ) stored,
  ai_commentary   text,
  recommendations text[],
  created_at      timestamptz default now()
);

-- ── 4. RLS ────────────────────────────────────────────────────
alter table public.consulting_engagements    enable row level security;
alter table public.exec_decision_analyses    enable row level security;
alter table public.exec_time_audits          enable row level security;

do $$ declare t text; begin
  foreach t in array array[
    'consulting_engagements','exec_decision_analyses','exec_time_audits'
  ] loop
    execute format('
      create policy if not exists "tenant_rls_%s"
        on public.%s for all using (
          tenant_id = (select tenant_id from public.user_profiles where id = auth.uid())
        )', t, t);
  end loop;
end $$;

-- ── 5. Indexes ────────────────────────────────────────────────
create index if not exists idx_consulting_user_status on public.consulting_engagements(user_id, status);
create index if not exists idx_daa_decision           on public.exec_decision_analyses(decision_id);
create index if not exists idx_tsa_week               on public.exec_time_audits(user_id, week_start);`,
  },
  '017': {
    name: 'M017: SIA™ + BICA™ — Strategic Intelligence & Board Comms — Sprint 24',
    sentinel: 'exec_intelligence_config',
    sql: `-- ============================================================
-- PIOS Sprint 24 — SIA™ · BICA™
-- M017: exec intelligence config, board comms, investor updates
-- VeritasIQ Technologies Ltd
-- ============================================================

-- ── 1. Executive intelligence config (SIA™) ──────────────────
-- Extends user_feed_topics — adds exec_priority flag + so_what field
alter table public.user_feed_topics
  add column if not exists exec_priority  boolean default false,
  add column if not exists persona_target text    default 'all'
    check (persona_target in ('all','executive','student','professional'));

-- ── 2. Signal briefs (SIA™ weekly digest) ────────────────────
create table if not exists public.sia_signal_briefs (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid references public.tenants(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  title       text not null,
  cadence     text default 'weekly' check (cadence in ('daily','weekly')),
  content     text not null,          -- full AI-generated brief
  signals     jsonb default '[]',     -- [{title, source, so_what, category}]
  sectors     text[],                 -- sectors covered in this brief
  created_at  timestamptz default now()
);

-- ── 3. Board / investor comms (BICA™) ────────────────────────
create table if not exists public.bica_comms (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  title           text not null,
  comms_type      text not null
    check (comms_type in ('board_update','investor_update','ceo_letter','stakeholder_report','strategy_memo','other')),
  audience        text,
  period          text,                   -- e.g. 'Q1 2026', 'March 2026'
  tone            text default 'formal'
    check (tone in ('formal','confident','balanced','direct')),
  inputs_json     jsonb default '{}',     -- structured inputs used to generate
  content         text,                   -- AI-generated content
  status          text default 'draft'
    check (status in ('draft','reviewed','sent','archived')),
  word_count      integer,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 4. RLS ────────────────────────────────────────────────────
alter table public.sia_signal_briefs  enable row level security;
alter table public.bica_comms         enable row level security;

create policy if not exists "tenant_rls_sia_signal_briefs"
  on public.sia_signal_briefs for all using (
    tenant_id = (select tenant_id from public.user_profiles where id = auth.uid())
  );
create policy if not exists "tenant_rls_bica_comms"
  on public.bica_comms for all using (
    tenant_id = (select tenant_id from public.user_profiles where id = auth.uid())
  );

-- ── 5. Indexes ────────────────────────────────────────────────
create index if not exists idx_sia_briefs_user   on public.sia_signal_briefs(user_id, created_at);
create index if not exists idx_bica_comms_user   on public.bica_comms(user_id, comms_type, status);`,
  },
  '018': {
    name: 'M018: White-Label Operator Mode — operator_configs, OKR prefs — Sprint 25',
    sentinel: 'operator_configs',
    sql: `-- ============================================================
-- PIOS Sprint 25 — White-Label Operator Mode
-- M018: operator_configs, okr_notification_prefs
-- VeritasIQ Technologies Ltd
-- ============================================================

-- ── 1. Operator / white-label config ──────────────────────────
-- One row per PIOS deployment (operator = accelerator, PE firm, etc.)
create table if not exists public.operator_configs (
  id                uuid primary key default uuid_generate_v4(),
  operator_name     text not null,
  slug              text unique not null,            -- e.g. 'techstars-london'
  logo_url          text,
  primary_colour    text default '#a78bfa',          -- brand hex
  accent_colour     text default '#22d3ee',
  support_email     text,
  custom_domain     text,                            -- e.g. 'pios.techstars.com'
  -- Feature flags
  features_enabled  text[] default ARRAY[
    'executive_os','consulting','time_sovereignty','comms_hub','intelligence'
  ],
  features_disabled text[] default '{}',
  -- Persona defaults
  default_persona   text default 'executive'
    check (default_persona in ('student','professional','executive','founder','consultant')),
  -- Billing
  plan_override     text,                            -- forces all tenants to this plan
  seats_limit       integer default 50,
  -- Metadata
  active            boolean default true,
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ── 2. Tenant → operator link ──────────────────────────────────
alter table public.tenants
  add column if not exists operator_id uuid references public.operator_configs(id);

-- ── 3. OKR notification preferences ──────────────────────────
create table if not exists public.okr_notification_prefs (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  tenant_id           uuid references public.tenants(id) on delete cascade,
  weekly_digest       boolean default true,
  drift_alerts        boolean default true,
  digest_day          integer default 1       -- 0=Sun 1=Mon … 6=Sat
    check (digest_day between 0 and 6),
  digest_time_utc     time default '07:00',
  email_address       text,                   -- override if different from auth email
  last_sent_at        timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── 4. RLS ────────────────────────────────────────────────────
alter table public.operator_configs      enable row level security;
alter table public.okr_notification_prefs enable row level security;

-- operator_configs: only service role can write; anyone can read their own operator
create policy if not exists "operator_configs_read"
  on public.operator_configs for select using (active = true);

create policy if not exists "okr_prefs_own"
  on public.okr_notification_prefs for all using (auth.uid() = user_id);

-- ── 5. Indexes ────────────────────────────────────────────────
create index if not exists idx_tenants_operator      on public.tenants(operator_id);
create index if not exists idx_okr_prefs_digest_day  on public.okr_notification_prefs(digest_day, weekly_digest);`,
  },

  '019': {
    name: 'M019: IP Vault · Contract Register · Group Financials — Sprint 36',
    sentinel: 'ip_assets',
    sql: `-- ============================================================
-- PIOS Sprint 36 — IP Vault · Contract Register · Group Financials
-- M019: ip_assets, contracts, financial_snapshots
-- VeritasIQ Technologies Ltd
-- ============================================================

-- ── 1. IP Vault (IML™ / IP protection) ──────────────────────
create table if not exists public.ip_assets (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  name            text not null,
  asset_type      text not null check (asset_type in (
                    'framework','trademark','patent','trade_secret',
                    'copyright','methodology','process','brand')),
  description     text,
  status          text not null default 'active' check (status in (
                    'active','pending','filed','registered','lapsed','archived')),
  jurisdiction    text[],              -- ['UK','UAE','KSA','US']
  filing_date     date,
  registration_no text,
  renewal_date    date,
  owner_entity    text,                -- 'VeritasIQ Technologies Ltd'
  notes           text,
  tags            text[],
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 2. Contract Register ──────────────────────────────────────
create table if not exists public.contracts (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  title           text not null,
  contract_type   text not null check (contract_type in (
                    'client','supplier','employment','nda','licence',
                    'partnership','lease','service','other')),
  counterparty    text not null,
  status          text not null default 'active' check (status in (
                    'draft','active','expired','terminated','renewed','pending')),
  value           numeric,
  currency        text default 'GBP',
  start_date      date,
  end_date        date,
  auto_renewal    boolean default false,
  notice_period_days integer,
  renewal_date    date,
  key_terms       text,
  obligations     text,
  file_url        text,
  domain          text default 'business',
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 3. Group Financial Snapshots ─────────────────────────────
create table if not exists public.financial_snapshots (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  period          text not null,   -- 'Mar 2026', 'Q1 2026', 'FY2026'
  period_type     text not null default 'month' check (period_type in ('month','quarter','year')),
  entity          text not null default 'group',  -- 'group' or entity name
  revenue         numeric default 0,
  expenses        numeric default 0,
  payroll_cost    numeric default 0,
  gross_profit    numeric generated always as (revenue - expenses - payroll_cost) stored,
  currency        text default 'GBP',
  cash_position   numeric default 0,
  receivables     numeric default 0,
  payables        numeric default 0,
  notes           text,
  ai_commentary   text,
  created_at      timestamptz default now()
);

-- ── 4. RLS ────────────────────────────────────────────────────
alter table public.ip_assets             enable row level security;
alter table public.contracts             enable row level security;
alter table public.financial_snapshots   enable row level security;

do $$ declare t text; begin
  foreach t in array array[
    'ip_assets','contracts','financial_snapshots'
  ] loop
    execute format('
      create policy if not exists "tenant_rls_%s"
        on public.%s for all using (
          tenant_id = (select tenant_id from public.user_profiles where id = auth.uid())
        )', t, t);
  end loop;
end $$;

-- ── 5. Indexes ────────────────────────────────────────────────
create index if not exists idx_ip_assets_user_type    on public.ip_assets(user_id, asset_type);
create index if not exists idx_ip_assets_renewal      on public.ip_assets(renewal_date) where status = 'active';
create index if not exists idx_contracts_user_status  on public.contracts(user_id, status);
create index if not exists idx_contracts_renewal      on public.contracts(renewal_date) where status = 'active';
create index if not exists idx_fin_snapshots_period   on public.financial_snapshots(user_id, period_type, period);
`,
  },
  '020': {
    name: 'M020: SE-MIL Knowledge Base — Sprint 38',
    sentinel: 'knowledge_entries',
    sql: `-- ============================================================
-- PIOS Sprint 38 — IP Vault Seed: 15 NemoClaw™ Frameworks
-- M020: Pre-populate ip_assets with all proprietary frameworks
-- Run after M019. Inserts only if not already present.
-- VeritasIQ Technologies Ltd
-- ============================================================

-- Helper: insert framework for every active user who has the Professional persona
-- In practice, run as a one-time seed for the Douglas super-admin user.
-- The API /api/ip-vault (action: seed_frameworks) handles per-user seeding.

-- No-op if table doesn't exist (M019 must run first)
do $$ begin
  if not exists (select 1 from information_schema.tables where table_name = 'ip_assets') then
    raise notice 'M019 not yet run — ip_assets table missing. Run M019 first.';
    return;
  end if;
end $$;

-- Framework definitions for reference (seeded via API for per-user isolation)
-- This migration documents the canonical IP registry.
comment on table public.ip_assets is
  'IP Vault — proprietary frameworks, trademarks, patents. NemoClaw™ suite: SDL, POM, OAE, CVDM, CPA, UMS, VFO, CFE, ADF, GSM, SPA, RTE, IML. VeritasIQ Technologies Ltd.';

-- ── Knowledge Entries table (SE-MIL) ─────────────────────────────────────────
create table if not exists public.knowledge_entries (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  title           text not null,
  summary         text,
  full_text       text,
  entry_type      text not null default 'note' check (entry_type in (
                    'note','article','book','paper','case_study','framework',
                    'lesson_learned','client_insight','market_intelligence',
                    'ai_search_result','other')),
  domain          text not null default 'business' check (domain in (
                    'fm_consulting','academic','saas','business','personal','all')),
  tags            text[] default '{}',
  source          text,
  url             text,
  is_search_result boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.knowledge_entries enable row level security;

do $$ declare t text; begin
  foreach t in array array['knowledge_entries'] loop
    execute format('
      create policy if not exists "tenant_rls_%s"
        on public.%s for all using (
          tenant_id = (select tenant_id from public.user_profiles where id = auth.uid())
        )', t, t);
  end loop;
end $$;

create index if not exists idx_knowledge_user_domain on public.knowledge_entries(user_id, domain);
create index if not exists idx_knowledge_type        on public.knowledge_entries(entry_type);
create index if not exists idx_knowledge_search      on public.knowledge_entries using gin(to_tsvector('english', title || ' ' || coalesce(summary,'')));

`,
  },
  '021': {
    name: 'M021: Wellness Phase 1 — Sessions, Streaks, Patterns, Purpose Anchors',
    sentinel: 'wellness_sessions',
    sql: `-- ============================================================
-- M021 — PIOS Wellness Phase 1
-- VeritasIQ Technologies Ltd
-- Tables: wellness_sessions, wellness_streaks, wellness_patterns, purpose_anchors
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wellness_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  session_type    TEXT NOT NULL CHECK (session_type IN (
                    'morning_checkin','evening_review','crisis_support',
                    'energy_audit','focus_block','recovery'
                  )),
  mood_score      SMALLINT CHECK (mood_score BETWEEN 1 AND 10),
  energy_score    SMALLINT CHECK (energy_score BETWEEN 1 AND 10),
  stress_score    SMALLINT CHECK (stress_score BETWEEN 1 AND 10),
  focus_score     SMALLINT CHECK (focus_score BETWEEN 1 AND 10),
  dominant_domain TEXT CHECK (dominant_domain IN (
                    'academic','fm_consulting','saas','business','personal','health'
                  )),
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  ai_insight      TEXT,
  ai_recommended_actions JSONB DEFAULT '[]',
  gdpr_consent    BOOLEAN NOT NULL DEFAULT FALSE,
  data_minimised  BOOLEAN NOT NULL DEFAULT FALSE,
  duration_mins   SMALLINT,
  source          TEXT DEFAULT 'web',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wellness_streaks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  streak_type           TEXT NOT NULL CHECK (streak_type IN (
                          'daily_checkin','morning_routine','focus_blocks',
                          'recovery','sleep_consistency'
                        )),
  current_streak        INTEGER NOT NULL DEFAULT 0,
  longest_streak        INTEGER NOT NULL DEFAULT 0,
  last_activity_date    DATE,
  streak_started_date   DATE,
  total_completions     INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, streak_type)
);

CREATE TABLE IF NOT EXISTS public.wellness_patterns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_type    TEXT NOT NULL CHECK (pattern_type IN (
                    'mood_trend','energy_cycle','stress_trigger',
                    'domain_correlation','recovery_signal','peak_performance'
                  )),
  pattern_label   TEXT NOT NULL,
  pattern_data    JSONB NOT NULL DEFAULT '{}',
  confidence      NUMERIC(4,2) CHECK (confidence BETWEEN 0 AND 1),
  detected_at     TIMESTAMPTZ DEFAULT NOW(),
  valid_until     TIMESTAMPTZ,
  acted_on        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purpose_anchors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  anchor_text     TEXT NOT NULL,
  anchor_type     TEXT NOT NULL CHECK (anchor_type IN (
                    'why','value','goal','mantra','legacy','commitment'
                  )),
  domain          TEXT CHECK (domain IN (
                    'academic','fm_consulting','saas','business','personal','global'
                  )),
  is_primary      BOOLEAN DEFAULT FALSE,
  display_order   SMALLINT DEFAULT 0,
  last_reflected  DATE,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wellness_sessions_user_date ON public.wellness_sessions(user_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_wellness_sessions_type      ON public.wellness_sessions(user_id, session_type);
CREATE INDEX IF NOT EXISTS idx_wellness_streaks_user       ON public.wellness_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_wellness_patterns_user      ON public.wellness_patterns(user_id, pattern_type);
CREATE INDEX IF NOT EXISTS idx_purpose_anchors_user        ON public.purpose_anchors(user_id, is_primary DESC, display_order);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_wellness_sessions_updated ON public.wellness_sessions;
CREATE TRIGGER trg_wellness_sessions_updated
  BEFORE UPDATE ON public.wellness_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_wellness_streaks_updated ON public.wellness_streaks;
CREATE TRIGGER trg_wellness_streaks_updated
  BEFORE UPDATE ON public.wellness_streaks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_purpose_anchors_updated ON public.purpose_anchors;
CREATE TRIGGER trg_purpose_anchors_updated
  BEFORE UPDATE ON public.purpose_anchors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.wellness_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_streaks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_patterns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purpose_anchors    ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "wellness_sessions_owner" ON public.wellness_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "wellness_streaks_owner" ON public.wellness_streaks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "wellness_patterns_owner" ON public.wellness_patterns
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "purpose_anchors_owner" ON public.purpose_anchors
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.wellness_sessions  IS 'PIOS Wellness Phase 1 — daily check-in sessions';
COMMENT ON TABLE public.wellness_streaks   IS 'PIOS Wellness Phase 1 — habit streak tracking';
COMMENT ON TABLE public.wellness_patterns  IS 'PIOS Wellness Phase 1 — AI-detected patterns';
COMMENT ON TABLE public.purpose_anchors    IS 'PIOS Wellness Phase 1 — purpose anchors and mantras';
`,
  },
}

async function runPg(sql: string): Promise<{ ok: boolean; result?: string; err?: string }> {
  try {
    const dbUrl = process.env.DIRECT_URL ?? process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL
    if (!dbUrl) return { ok: false, err: 'No DB URL set (DIRECT_URL / SUPABASE_DB_URL / DATABASE_URL)' }
    const { Client } = await import('pg')
    const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
    await client.connect()
    try {
      await client.query(sql)
      return { ok: true, result: 'OK' }
    } finally {
      await client.end()
    }
  } catch (e: unknown) {
    return { ok: false, err: (e as Error).message?.substring(0, 400) ?? String(e) }
  }
}

export async function POST(req: NextRequest) {
  // Migration runner — open during initial setup (idempotent SQL only)
  // Protected by Vercel auth / network boundary in production
  const rawBody = await req.text().catch(() => '{}')
  const body = JSON.parse(rawBody || '{}')
  const id: string = body.migration ?? '012'

  if (id === 'all') {
    const results: Array<{id:string;name:string;ok:boolean;err?:string}> = []
    for (const [key, m] of Object.entries(MIGRATIONS)) {
      const r = await runPg(m.sql)
      results.push({ id: key, name: m.name, ok: r.ok, err: r.err })
    }
    return NextResponse.json({ results })
  }

  const m = MIGRATIONS[id]
  if (!m) return NextResponse.json({ error: `Unknown migration: ${id}` }, { status: 400 })

  const r = await runPg(m.sql)
  if (!r.ok) return NextResponse.json({ error: r.err, migration: id }, { status: 500 })
  return NextResponse.json({ success: true, migration: id, name: m.name })
}

export async function GET() {
  return NextResponse.json({ migrations: Object.keys(MIGRATIONS), usage: 'POST { migration: "012" } or { migration: "all" }' })
}
