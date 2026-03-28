export const dynamic     = 'force-dynamic'
export const maxDuration = 120

/**
 * POST /api/admin/migrate-pending
 * Applies all pending PIOS migrations M001–M027.
 *
 * Connection strategy (in order):
 *   1. exec_sql RPC via service role key  ← primary (works from Vercel)
 *   2. pg pooler (port 6543, not 5432)    ← fallback if SUPABASE_DB_POOLER_URL set
 *
 * The raw DB hostname (db.xxx.supabase.co:5432) does NOT work from
 * Vercel serverless — use the pooler URL instead.
 *
 * Auth: x-admin-secret header = ADMIN_SECRET env var
 *       (or SEED_SECRET for backward compat)
 *
 * PIOS v3.0.5 | VeritasIQ Technologies Ltd
 */

import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ── Supabase pooler URL (works from Vercel) ──────────────────────────────
// Format: postgresql://postgres.[ref]:[password]@aws-1-eu-west-1.pooler.supabase.com:6543/postgres
// Get from: Supabase dashboard → Settings → Database → Connection string → Transaction pooler
function getPoolerUrl(): string | null {
  return (
    process.env.SUPABASE_DB_POOLER_URL   ??  // Set this in Vercel — transaction pooler URL
    process.env.DATABASE_URL             ??  // Fallback
    null
  )
}

// ── Run SQL via exec_sql RPC (primary path from Vercel) ──────────────────
async function runViaRPC(sql: string): Promise<{ ok: boolean; error?: string }> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { ok: false, error: 'SUPABASE_URL or SERVICE_ROLE_KEY not set' }
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey':         SERVICE_KEY,
        'Prefer':         'return=minimal',
      },
      body: JSON.stringify({ sql_query: sql }),
    })

    if (res.ok) return { ok: true }

    const text = await res.text().catch(() => '')

    // exec_sql doesn't exist yet
    if (res.status === 404 || text.includes('Could not find the function')) {
      return {
        ok:    false,
        error: 'exec_sql RPC not found. Run 00_create_exec_sql_rpc.sql in Supabase SQL editor first.',
      }
    }

    // Parse the error response
    let errorMsg = text.slice(0, 500)
    try {
      const parsed = JSON.parse(text)
      errorMsg = parsed?.error ?? parsed?.message ?? parsed?.hint ?? errorMsg
    } catch {}

    return { ok: false, error: errorMsg }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Run SQL via pg pooler (fallback if SUPABASE_DB_POOLER_URL set) ───────
async function runViaPooler(sql: string): Promise<{ ok: boolean; error?: string }> {
  const poolerUrl = getPoolerUrl()
  if (!poolerUrl) return { ok: false, error: 'No pooler URL configured' }

  try {
    const { Client } = await import('pg')
    const client = new Client({
      connectionString: poolerUrl,
      ssl:              { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    })
    await client.connect()
    try {
      await client.query(sql)
      await client.end()
      return { ok: true }
    } catch (qErr: unknown) {
      await client.end().catch(() => {})
      return { ok: false, error: qErr instanceof Error ? qErr.message : String(qErr) }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    // ENOTFOUND = wrong hostname, give clear guidance
    if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      return {
        ok:    false,
        error: `DNS failure: "${msg}". Use the Supabase Transaction Pooler URL (port 6543), not the direct DB URL (port 5432). Set SUPABASE_DB_POOLER_URL in Vercel.`,
      }
    }
    return { ok: false, error: msg }
  }
}

// ── Try both paths ────────────────────────────────────────────────────────
async function runSQL(sql: string, label: string): Promise<{
  ok: boolean; method?: string; error?: string; label: string
}> {
  // Path 1: exec_sql RPC (works from Vercel without extra config)
  const rpcResult = await runViaRPC(sql)
  if (rpcResult.ok) return { ok: true, method: 'exec_sql_rpc', label }

  // Path 2: pg pooler (requires SUPABASE_DB_POOLER_URL)
  if (getPoolerUrl()) {
    const pgResult = await runViaPooler(sql)
    if (pgResult.ok) return { ok: true, method: 'pg_pooler', label }
    return { ok: false, method: 'pg_pooler', error: pgResult.error, label }
  }

  return { ok: false, method: 'exec_sql_rpc', error: rpcResult.error, label }
}

// ── Auth check ────────────────────────────────────────────────────────────
function isAuthorised(req: NextRequest): boolean {
  const provided = req.headers.get('x-admin-secret') ?? req.headers.get('x-seed-secret')
  const expected = process.env.ADMIN_SECRET ?? process.env.SEED_SECRET
  if (!expected) return false
  return provided === expected
}

// ── Migration registry ────────────────────────────────────────────────────
// Each migration is embedded here so the runner works without filesystem access.
// Migrations are idempotent — safe to re-run.
// To add a new migration: append to MIGRATIONS array.

const MIGRATIONS: Array<{ id: string; label: string; sql: string }> = [
  {
    id:    'M019',
    label: 'IP Vault, contracts, financial snapshots',
    sql: `
CREATE TABLE IF NOT EXISTS ip_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, type TEXT, status TEXT DEFAULT 'active',
  description TEXT, filing_date DATE, registration_number TEXT,
  jurisdiction TEXT, expiry_date DATE, value_gbp NUMERIC,
  notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ip_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "ip_user_owns" ON ip_assets FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, party TEXT, type TEXT, status TEXT DEFAULT 'active',
  value_gbp NUMERIC, start_date DATE, end_date DATE,
  renewal_date DATE, notes TEXT, document_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "contracts_user_owns" ON contracts FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS financial_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL, revenue_gbp NUMERIC, burn_gbp NUMERIC,
  cash_position NUMERIC, receivables NUMERIC, payables NUMERIC,
  runway_months INT, ai_commentary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE financial_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "fin_user_owns" ON financial_snapshots FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_financial_snapshots_user ON financial_snapshots(user_id);
`,
  },
  {
    id:    'M020',
    label: 'Knowledge entries',
    sql: `
CREATE TABLE IF NOT EXISTS knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, content TEXT, category TEXT DEFAULT 'insight',
  source TEXT, tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE knowledge_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "knowledge_user_owns" ON knowledge_entries FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_knowledge_user ON knowledge_entries(user_id);
`,
  },
  {
    id:    'M021',
    label: 'Wellness tables + Stripe billing',
    sql: `
CREATE TABLE IF NOT EXISTS wellness_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mood_score INT CHECK (mood_score BETWEEN 1 AND 10),
  energy_score INT, stress_score INT, focus_score INT,
  notes TEXT, ai_insight TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE wellness_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "wellness_user_owns" ON wellness_sessions FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS wellness_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INT DEFAULT 0, longest_streak INT DEFAULT 0,
  last_activity_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE wellness_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "streaks_user_owns" ON wellness_streaks FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS wellness_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_type TEXT, description TEXT, detected_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE wellness_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "patterns_user_owns" ON wellness_patterns FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS purpose_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anchor_text TEXT, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE purpose_anchors ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "anchors_user_owns" ON purpose_anchors FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Stripe billing columns
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'none';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe ON user_profiles(stripe_customer_id);
`,
  },
  {
    id:    'M022',
    label: 'NemoClaw CV calibration + pios-cv bucket',
    sql: `
CREATE TABLE IF NOT EXISTS nemoclaw_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT, job_title TEXT, organisation TEXT,
  seniority_level TEXT, primary_industry TEXT,
  industries TEXT[], skills TEXT[], qualifications TEXT[],
  employers TEXT[], key_achievements TEXT[],
  communication_register TEXT DEFAULT 'professional',
  coaching_intensity TEXT DEFAULT 'balanced',
  recommended_frameworks TEXT[],
  growth_areas TEXT[], strengths TEXT[],
  decision_style TEXT, calibration_summary TEXT,
  calibration_version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE nemoclaw_calibration ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "cal_user_owns" ON nemoclaw_calibration FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_nemoclaw_cal_user ON nemoclaw_calibration(user_id);

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS cv_filename TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS cv_uploaded_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS cv_processing_status TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS cv_storage_path TEXT;
`,
  },
  {
    id:    'M023',
    label: 'Exec intelligence config + AI credits',
    sql: `
CREATE TABLE IF NOT EXISTS exec_intelligence_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_calls_used INT DEFAULT 0,
  ai_calls_limit INT DEFAULT 100,
  reset_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  brief_enabled BOOLEAN DEFAULT true,
  brief_time TEXT DEFAULT '07:00',
  timezone TEXT DEFAULT 'Europe/London',
  persona TEXT DEFAULT 'executive',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE exec_intelligence_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "eic_user_owns" ON exec_intelligence_config FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS ai_credits_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_used INT DEFAULT 0, reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ai_credits_resets ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "credits_user_owns" ON ai_credits_resets FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS morning_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  brief_date DATE NOT NULL,
  summary_text TEXT,
  generated_by TEXT DEFAULT 'cron',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, brief_date)
);
ALTER TABLE morning_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "briefs_user_owns" ON morning_briefs FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_morning_briefs_user_date ON morning_briefs(user_id, brief_date DESC);
`,
  },
  {
    id:    'M024',
    label: 'Waitlist (early access capture)',
    sql: `
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT DEFAULT 'landing_page',
  notes TEXT, invited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
`,
  },
  {
    id:    'M025',
    label: 'Billing columns on user_profiles (idempotent)',
    sql: `
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'none';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;
`,
  },
  {
    id:    'M026',
    label: 'Content Studio (Blood Oath Chronicles pipeline)',
    sql: `
CREATE TABLE IF NOT EXISTS content_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, slug TEXT NOT NULL, platform TEXT DEFAULT 'pocket_fm',
  platform_series_id TEXT, platform_url TEXT, studio_url TEXT,
  genre TEXT, status TEXT DEFAULT 'active',
  total_episodes INT DEFAULT 0, published_episodes INT DEFAULT 0,
  current_episode INT DEFAULT 1, word_target INT DEFAULT 1375,
  bible TEXT, style_guide TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE content_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "series_user_owns" ON content_series FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS content_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID REFERENCES content_series(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_number INT NOT NULL,
  title TEXT NOT NULL,
  manuscript_text TEXT, published_text TEXT, draft_text TEXT,
  platform_chapter_id TEXT, platform_episode_id TEXT,
  status TEXT DEFAULT 'draft',
  review_score INT, consistency_score INT,
  review_notes TEXT, manuscript_matches_published BOOLEAN DEFAULT false,
  last_compared_at TIMESTAMPTZ, word_count INT,
  episode_arc TEXT, cliffhanger TEXT,
  key_events TEXT[], characters_featured TEXT[],
  drafted_at TIMESTAMPTZ, approved_at TIMESTAMPTZ, published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(series_id, episode_number)
);
ALTER TABLE content_episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "episodes_user_owns" ON content_episodes FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_episodes_series ON content_episodes(series_id, episode_number);

CREATE TABLE IF NOT EXISTS content_review_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID REFERENCES content_series(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES content_episodes(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL, status TEXT DEFAULT 'pending',
  episode_from INT, episode_to INT,
  findings JSONB DEFAULT '[]', summary TEXT,
  overall_score INT, recommendations JSONB DEFAULT '[]',
  adopted_count INT DEFAULT 0,
  started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE content_review_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "review_jobs_user_owns" ON content_review_jobs FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS content_publish_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID REFERENCES content_series(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES content_episodes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, platform TEXT DEFAULT 'pocket_fm',
  platform_response JSONB, success BOOLEAN, error_message TEXT,
  published_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE content_publish_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "publish_log_user_owns" ON content_publish_log FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
`,
  },
  {
    id:    'M027',
    label: 'Sprint J tables (stakeholders, publications, intelligence prefs)',
    sql: `
CREATE TABLE IF NOT EXISTS stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, role TEXT NOT NULL, organisation TEXT,
  influence INT DEFAULT 3 CHECK (influence BETWEEN 1 AND 5),
  alignment INT DEFAULT 3 CHECK (alignment BETWEEN 1 AND 5),
  engagement TEXT DEFAULT 'medium',
  notes TEXT, tags TEXT[] DEFAULT '{}',
  last_contact TIMESTAMPTZ, next_action TEXT, next_action_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE stakeholders ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "stakeholders_user_owns" ON stakeholders FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_stakeholders_user ON stakeholders(user_id);

CREATE TABLE IF NOT EXISTS publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'journal',
  status TEXT DEFAULT 'draft',
  venue TEXT, authors TEXT, year INT,
  doi TEXT, url TEXT, abstract TEXT, notes TEXT,
  submitted_at TIMESTAMPTZ, accepted_at TIMESTAMPTZ, published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "publications_user_owns" ON publications FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_publications_user ON publications(user_id);

CREATE TABLE IF NOT EXISTS intelligence_prefs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  topics TEXT[] DEFAULT ARRAY['fm','gcc','saas','ai'],
  refresh_freq TEXT DEFAULT 'daily',
  last_refreshed TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE intelligence_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "intel_prefs_user_owns" ON intelligence_prefs FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
`,
  },
]

// ── POST handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised — set x-admin-secret header' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const targetId = body.migration_id  // optional — run single migration

  const toRun = targetId
    ? MIGRATIONS.filter(m => m.id === targetId)
    : MIGRATIONS

  if (toRun.length === 0) {
    return NextResponse.json({ error: `Migration ${targetId} not found` }, { status: 404 })
  }

  const results: Array<{
    id: string; label: string; ok: boolean; method?: string; error?: string
  }> = []

  for (const migration of toRun) {
    const result = await runSQL(migration.sql, migration.label)
    results.push({ id: migration.id, label: migration.label, ...result })

    // Stop on critical failure (but continue on column-already-exists errors)
    if (!result.ok) {
      const isNonCritical = result.error?.includes('already exists') ||
                            result.error?.includes('duplicate') ||
                            result.error?.includes('42701')  // duplicate column code
      if (!isNonCritical) {
        return NextResponse.json({
          ok:      false,
          stopped: true,
          failed:  migration.id,
          error:   result.error,
          results,
          fix:     result.error?.includes('exec_sql') || result.error?.includes('Could not find')
            ? 'Run 00_create_exec_sql_rpc.sql in Supabase SQL editor first, then retry.'
            : result.error?.includes('ENOTFOUND') || result.error?.includes('getaddrinfo')
              ? 'DNS failure: use Supabase Transaction Pooler URL (port 6543) in SUPABASE_DB_POOLER_URL env var.'
              : 'Check Supabase dashboard for more details.',
        }, { status: 500 })
      }
    }
  }

  const passed = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length

  return NextResponse.json({
    ok:      failed === 0,
    passed,
    failed,
    total:   results.length,
    results,
    method:  results[0]?.method ?? 'unknown',
  })
}

// ── GET — list available migrations ──────────────────────────────────────
export async function GET() {
  return NextResponse.json({
    migrations: MIGRATIONS.map(m => ({ id: m.id, label: m.label })),
    count:      MIGRATIONS.length,
    note:       'POST with x-admin-secret header to run. POST with { migration_id: "M019" } to run single.',
  })
}
