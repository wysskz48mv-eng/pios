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
$$ LANGUAGE plpgsql;`,
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
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== OWNER_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const id: string = body.migration ?? '012'

  if (id === 'all') {
    const results: unknown[]$1
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
