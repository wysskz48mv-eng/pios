export const dynamic    = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/admin/migrate-pending
 * Applies pending PIOS migrations M019–M023 plus pios-cv storage bucket.
 *
 * Auth: x-admin-secret header matching ADMIN_SECRET env var.
 *       Falls back to SEED_SECRET for compatibility.
 *
 * Tries two execution paths in order:
 *   1. Direct pg connection via DIRECT_URL / SUPABASE_DB_URL
 *   2. Supabase exec_sql RPC via service role key
 *
 * All migrations are idempotent — safe to re-run.
 *
 * PIOS v3.0.3 | VeritasIQ Technologies Ltd
 */

import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ── Execution: try direct pg first, fall back to exec_sql RPC ──────────────
async function runSQL(sql: string): Promise<{ ok: boolean; method?: string; error?: string }> {
  // Path 1: direct pg connection (fastest, most reliable)
  const dbUrl = process.env.DIRECT_URL ?? process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL
  if (dbUrl) {
    try {
      const { Client } = await import('pg')
      const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      await client.connect()
      try {
        await client.query(sql)
        return { ok: true, method: 'pg_direct' }
      } finally {
        await client.end().catch(() => {})
      }
    } catch (e: any) {
      // fall through to RPC
    }
  }

  // Path 2: exec_sql RPC via service role
  if (SUPABASE_URL && SERVICE_ROLE_KEY) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey':         SERVICE_ROLE_KEY,
          'Prefer':         'return=minimal',
        },
        body: JSON.stringify({ sql_query: sql }),
      })
      if (res.ok) return { ok: true, method: 'exec_sql_rpc' }
      const text = await res.text().catch(() => '')
      return { ok: false, method: 'exec_sql_rpc', error: text.slice(0, 400) }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }

  return { ok: false, error: 'No execution path available — set DIRECT_URL or SUPABASE_DB_URL in Vercel' }
}

export async function POST(req: NextRequest) {
  // Auth: check x-admin-secret header against ADMIN_SECRET / SEED_SECRET env var.
  // If no env var is set, fall back to checking the user is authenticated via Supabase.
  const secret   = req.headers.get('x-admin-secret') ?? req.headers.get('x-seed-secret')
  const expected = process.env.ADMIN_SECRET ?? process.env.SEED_SECRET

  if (expected) {
    // Env var is set — enforce it
    if (!secret || secret !== expected) {
      return NextResponse.json({ error: 'Unauthorized — wrong admin secret' }, { status: 401 })
    }
  } else {
    // No env var set — require authenticated Supabase session instead
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized — sign in first or set ADMIN_SECRET env var' }, { status: 401 })
    }
  }

  const results: Record<string, any> = {}

  async function run(label: string, sql: string) {
    const r = await runSQL(sql)
    results[label] = r
    return r.ok
  }

  // ══ M019 — IP Vault · Contract Register · Group Financials ═════════════
  await run('M019_ip_assets', `
    create table if not exists public.ip_assets (
      id              uuid primary key default uuid_generate_v4(),
      tenant_id       uuid references public.tenants(id) on delete cascade,
      user_id         uuid references auth.users(id) on delete cascade,
      framework_code  text not null,
      framework_name  text not null,
      description     text,
      ip_type         text default 'methodology',
      status          text default 'active' check (status in ('active','pending','retired','licensed')),
      ip_clearance    text default 'pending' check (ip_clearance in ('cleared','pending','legal_review_required')),
      jurisdiction    text default 'UK',
      filing_ref      text,
      filed_at        date,
      granted_at      date,
      expiry_at       date,
      tags            text[],
      notes           text,
      created_at      timestamptz default now(),
      updated_at      timestamptz default now()
    );
    create index if not exists idx_ip_assets_tenant on public.ip_assets(tenant_id);
    create index if not exists idx_ip_assets_user   on public.ip_assets(user_id);
  `)

  await run('M019_contracts', `
    create table if not exists public.contracts (
      id              uuid primary key default uuid_generate_v4(),
      tenant_id       uuid references public.tenants(id) on delete cascade,
      user_id         uuid references auth.users(id) on delete cascade,
      contract_ref    text,
      title           text not null,
      counterparty    text,
      contract_type   text default 'service',
      status          text default 'draft' check (status in ('draft','active','expired','terminated','suspended')),
      value           numeric(14,2),
      currency        text default 'GBP',
      start_date      date,
      end_date        date,
      notice_period   integer,
      auto_renew      boolean default false,
      signed_at       date,
      file_url        text,
      notes           text,
      tags            text[],
      created_at      timestamptz default now(),
      updated_at      timestamptz default now()
    );
    create index if not exists idx_contracts_tenant on public.contracts(tenant_id);
    create index if not exists idx_contracts_user   on public.contracts(user_id);
  `)

  await run('M019_financials', `
    create table if not exists public.financial_snapshots (
      id              uuid primary key default uuid_generate_v4(),
      tenant_id       uuid references public.tenants(id) on delete cascade,
      user_id         uuid references auth.users(id) on delete cascade,
      period_label    text not null,
      period_start    date not null,
      period_end      date not null,
      entity_name     text,
      revenue         numeric(14,2) default 0,
      expenses        numeric(14,2) default 0,
      gross_profit    numeric(14,2) default 0,
      net_profit      numeric(14,2) default 0,
      currency        text default 'GBP',
      notes           text,
      source          text default 'manual',
      created_at      timestamptz default now()
    );
    create index if not exists idx_fin_snap_tenant on public.financial_snapshots(tenant_id);
  `)

  // ══ M020 — IP Vault seed (VeritasIQ frameworks) ══════════════════════════
  await run('M020_ip_seed', `
    do $$ begin
      if exists (select 1 from information_schema.tables where table_name = 'ip_assets') then
        insert into public.ip_assets (framework_code, framework_name, ip_type, status, ip_clearance, jurisdiction, description)
        values
          ('SDL',  'Sustainable Development Lens™',          'methodology', 'active', 'cleared', 'UK', 'ESG / sustainability assessment framework'),
          ('POM',  'Performance Operating Model™',           'methodology', 'active', 'cleared', 'UK', 'Organisational performance framework'),
          ('OAE',  'Organisational Agility Engine™',         'methodology', 'active', 'cleared', 'UK', 'Agile transformation methodology'),
          ('CVDM', 'Commercial Value Driver Model™',         'methodology', 'active', 'cleared', 'UK', 'Commercial value analysis framework'),
          ('CPA',  'Competitive Positioning Architecture™',  'methodology', 'active', 'cleared', 'UK', 'Strategic positioning tool'),
          ('UMS',  'Unified Management System™',             'methodology', 'active', 'cleared', 'UK', 'Integrated management system design'),
          ('VFO',  'Value For Outcomes™',                    'methodology', 'active', 'cleared', 'UK', 'Outcome-based value framework'),
          ('CFE',  'Commercial Framework Engine™',           'methodology', 'active', 'cleared', 'UK', 'Commercial structuring methodology'),
          ('ADF',  'Asset Deployment Framework™',            'methodology', 'active', 'cleared', 'UK', 'Asset optimisation and deployment tool'),
          ('GSM',  'Governance Stack Model™',                'methodology', 'active', 'cleared', 'UK', 'Governance architecture framework'),
          ('SPA',  'Strategic Partnership Architecture™',    'methodology', 'active', 'cleared', 'UK', 'Partnership design and governance'),
          ('RTE',  'Revenue Transformation Engine™',        'methodology', 'active', 'cleared', 'UK', 'Revenue strategy and transformation'),
          ('IML',  'Intellectual Methods Library™',          'database',    'active', 'cleared', 'UK', 'Proprietary method repository — PIOS core IP')
        on conflict do nothing;
      end if;
    end $$;
  `)

  // ══ M021 — Wellness Phase 1 ══════════════════════════════════════════════
  await run('M021_wellness_sessions', `
    create table if not exists public.wellness_sessions (
      id              uuid primary key default uuid_generate_v4(),
      user_id         uuid not null references auth.users(id) on delete cascade,
      tenant_id       uuid references public.tenants(id) on delete cascade,
      session_date    date not null default current_date,
      session_type    text not null check (session_type in ('mindfulness','exercise','sleep','nutrition','recovery','reflection','social')),
      duration_min    integer,
      intensity       text check (intensity in ('low','moderate','high')),
      mood_before     integer check (mood_before between 1 and 10),
      mood_after      integer check (mood_after between 1 and 10),
      energy_level    integer check (energy_level between 1 and 10),
      notes           text,
      tags            text[],
      created_at      timestamptz default now()
    );
    create index if not exists idx_wellness_sessions_user_date on public.wellness_sessions(user_id, session_date desc);
    create index if not exists idx_wellness_sessions_type      on public.wellness_sessions(user_id, session_type);
  `)

  await run('M021_wellness_streaks', `
    create table if not exists public.wellness_streaks (
      id              uuid primary key default uuid_generate_v4(),
      user_id         uuid not null references auth.users(id) on delete cascade,
      streak_type     text not null,
      current_streak  integer default 0,
      longest_streak  integer default 0,
      last_activity   date,
      updated_at      timestamptz default now(),
      unique(user_id, streak_type)
    );
    create index if not exists idx_wellness_streaks_user on public.wellness_streaks(user_id);
  `)

  await run('M021_wellness_patterns', `
    create table if not exists public.wellness_patterns (
      id              uuid primary key default uuid_generate_v4(),
      user_id         uuid not null references auth.users(id) on delete cascade,
      pattern_type    text not null,
      pattern_data    jsonb default '{}',
      insight         text,
      confidence      numeric(4,2) default 0.70,
      period_start    date,
      period_end      date,
      generated_at    timestamptz default now()
    );
  `)

  await run('M021_purpose_anchors', `
    create table if not exists public.purpose_anchors (
      id              uuid primary key default uuid_generate_v4(),
      user_id         uuid not null references auth.users(id) on delete cascade,
      anchor_type     text not null check (anchor_type in ('value','goal','relationship','achievement','commitment')),
      title           text not null,
      description     text,
      priority        integer default 5,
      active          boolean default true,
      created_at      timestamptz default now(),
      updated_at      timestamptz default now()
    );
    create index if not exists idx_purpose_anchors_user on public.purpose_anchors(user_id, active);
  `)

  // ══ M022 — NemoClaw™ CV calibration ══════════════════════════════════════
  await run('M022_nemoclaw_calibration', `
    create table if not exists public.nemoclaw_calibration (
      id                  uuid primary key default uuid_generate_v4(),
      user_id             uuid not null references auth.users(id) on delete cascade,
      calibration_version integer default 1,
      cv_text             text,
      cv_summary          text,
      key_skills          text[],
      experience_years    integer,
      seniority_level     text,
      domain_focus        text[],
      calibration_data    jsonb default '{}',
      calibration_score   numeric(4,2),
      model_used          text default 'claude-sonnet-4-20250514',
      calibrated_at       timestamptz default now(),
      is_current          boolean default true
    );
    create index if not exists idx_nemoclaw_cal_user on public.nemoclaw_calibration(user_id, is_current);
  `)

  await run('M022_pios_cv_bucket', `
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('pios-cv', 'pios-cv', false, 10485760)
    on conflict (id) do nothing;
  `)

  await run('M022_cv_bucket_policies', `
    drop policy if exists "pios_cv_owner_upload" on storage.objects;
    drop policy if exists "pios_cv_owner_read"   on storage.objects;
    drop policy if exists "pios_cv_owner_delete" on storage.objects;

    create policy "pios_cv_owner_upload" on storage.objects
      for insert with check (
        bucket_id = 'pios-cv'
        and auth.uid()::text = (storage.foldername(name))[1]
      );

    create policy "pios_cv_owner_read" on storage.objects
      for select using (
        bucket_id = 'pios-cv'
        and auth.uid()::text = (storage.foldername(name))[1]
      );

    create policy "pios_cv_owner_delete" on storage.objects
      for delete using (
        bucket_id = 'pios-cv'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  `)

  // ══ M023 — Executive Intelligence Config + AI Credits Reset ══════════════
  await run('M023_exec_intel_config', `
    create table if not exists public.exec_intelligence_config (
      id                  uuid primary key default uuid_generate_v4(),
      user_id             uuid not null references auth.users(id) on delete cascade,
      config_version      integer default 1,
      focus_areas         text[] default '{}',
      risk_tolerance      text default 'moderate' check (risk_tolerance in ('conservative','moderate','aggressive')),
      decision_horizon    text default 'medium_term',
      briefing_frequency  text default 'daily',
      ai_persona_mode     text default 'advisor',
      custom_instructions text,
      active              boolean default true,
      created_at          timestamptz default now(),
      updated_at          timestamptz default now(),
      unique(user_id)
    );

    alter table public.exec_intelligence_config enable row level security;

    drop policy if exists "exec_intel_config_own" on public.exec_intelligence_config;
    create policy "exec_intel_config_own" on public.exec_intelligence_config
      for all using (user_id = auth.uid());

    create index if not exists idx_exec_intel_config_user
      on public.exec_intelligence_config(user_id);
  `)

  await run('M023_ai_credits_resets', `
    create table if not exists public.ai_credits_resets (
      id              uuid primary key default uuid_generate_v4(),
      tenant_id       uuid references public.tenants(id) on delete cascade,
      user_id         uuid references auth.users(id) on delete cascade,
      reset_reason    text not null check (reset_reason in ('monthly_cycle','plan_upgrade','admin_grant','promotional')),
      credits_granted integer not null default 0,
      credits_before  integer not null default 0,
      credits_after   integer not null default 0,
      triggered_by    text,
      notes           text,
      created_at      timestamptz default now()
    );

    alter table public.ai_credits_resets enable row level security;

    drop policy if exists "ai_credits_resets_own" on public.ai_credits_resets;
    create policy "ai_credits_resets_own" on public.ai_credits_resets
      for all using (user_id = auth.uid());

    create index if not exists idx_ai_credits_resets_tenant
      on public.ai_credits_resets(tenant_id, created_at desc);
    create index if not exists idx_ai_credits_resets_user
      on public.ai_credits_resets(user_id, created_at desc);
  `)

  // ── M000 — Fix user_profiles RLS (missing UPDATE policy) ────────────────
  // Migration 001 only creates a USING policy (SELECT/DELETE).
  // UPDATE and INSERT are blocked unless WITH CHECK is added.
  await run('M000_user_profiles_rls_update', `
    DROP POLICY IF EXISTS "user_profiles_update" ON public.user_profiles;
    CREATE POLICY "user_profiles_update"
      ON public.user_profiles
      FOR UPDATE
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());

    DROP POLICY IF EXISTS "user_profiles_insert" ON public.user_profiles;
    CREATE POLICY "user_profiles_insert"
      ON public.user_profiles
      FOR INSERT
      WITH CHECK (id = auth.uid());
  `)

  // ── Summary ────────────────────────────────────────────────────────────
  const passed = Object.values(results).filter((r: any) => r.ok).length
  const failed = Object.values(results).filter((r: any) => !r.ok)

  return NextResponse.json({
    success:  failed.length === 0,
    passed,
    failed:   failed.length,
    results,
    order: [
      'M019 ip_assets table',
      'M019 contracts table',
      'M019 financial_snapshots table',
      'M020 IP asset seed (13 VeritasIQ frameworks)',
      'M021 wellness_sessions',
      'M021 wellness_streaks',
      'M021 wellness_patterns',
      'M021 purpose_anchors',
      'M022 nemoclaw_calibration table',
      'M022 pios-cv storage bucket',
      'M022 pios-cv bucket RLS policies',
      'M023 exec_intelligence_config',
      'M023 ai_credits_resets',
    ],
    next: failed.length > 0
      ? 'Set DIRECT_URL (Supabase direct connection string) in Vercel env vars, then re-run. Or create exec_sql function in Supabase SQL Editor first.'
      : 'Migrations complete. Run /api/health to verify. Then seed NemoClaw via /api/admin/seed-demo if needed.',
  })
}
