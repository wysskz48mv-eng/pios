/**
 * POST /api/admin/run-migration
 * Applies PIOS migrations 008–012 via direct pg connection.
 * Auth: owner email (info@sustain-intl.com) session.
 * PIOS v2.2 | Sprint 28 | VeritasIQ Technologies Ltd
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/redis-rate-limit'
import { requireMFA } from '@/lib/mfa'

const OWNER_EMAIL = 'info@sustain-intl.com'

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
    return { ok: false, err: e.message?.substring(0, 400) ?? String(e) }
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const rl = await checkRateLimit({ key: `pios:admin:${ip}`, ...LIMITS.admin })
  if (rl) return rl
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== OWNER_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // MFA guard — admin routes require AAL2 if enrolled
  const mfaError = await requireMFA(supabase)
  if (mfaError) return mfaError

  const body = await req.json().catch(() => ({}))
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
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== OWNER_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  return NextResponse.json({ migrations: Object.keys(MIGRATIONS), usage: 'POST { migration: "012" } or { migration: "all" }' })
}
