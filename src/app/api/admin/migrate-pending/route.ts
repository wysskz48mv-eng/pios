export const dynamic     = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/admin/migrate-pending
 * Applies M019–M023 via exec_sql RPC or direct pg connection.
 * PIOS v3.0.4 | VeritasIQ Technologies Ltd
 */

import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function runSQL(sql: string): Promise<{ ok: boolean; method?: string; error?: string }> {
  // Path 1: direct pg
  const dbUrl = process.env.DIRECT_URL ?? process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL
  if (dbUrl) {
    try {
      const { Client } = await import('pg')
      const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      await client.connect()
      try { await client.query(sql); return { ok: true, method: 'pg_direct' } }
      finally { await client.end().catch(() => {}) }
    } catch { /* fall through */ }
  }

  // Path 2: exec_sql RPC
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey':         SERVICE_ROLE_KEY,
      'Prefer':         'return=minimal',
    },
    body: JSON.stringify({ sql_query: sql }),
  })
  if (res.ok) return { ok: true, method: 'exec_sql_rpc' }
  const err = await res.text().catch(() => '')
  return { ok: false, method: 'exec_sql_rpc', error: err.slice(0, 300) }
}

export async function POST(req: NextRequest) {
  const results: Record<string, any> = {}

  async function run(label: string, sql: string) {
    const r = await runSQL(sql)
    results[label] = r
    return r.ok
  }

  // ── Check exec_sql exists first ──────────────────────────────────────────
  const check = await runSQL('SELECT 1')
  if (!check.ok) {
    return NextResponse.json({
      success: false,
      error:   'exec_sql RPC not found',
      fix:     'Run this SQL once in Supabase Dashboard → SQL Editor:\n\nCREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)\nRETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN EXECUTE sql_query; END; $$;\nGRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;',
      results,
    })
  }

  // ══ M019 ═══════════════════════════════════════════════════════════════════
  await run('M019_ip_assets', `
    create table if not exists public.ip_assets (
      id              uuid primary key default uuid_generate_v4(),
      tenant_id       uuid references public.tenants(id) on delete cascade,
      user_id         uuid references auth.users(id) on delete cascade,
      name            text not null,
      asset_type      text not null default 'trademark'
        check (asset_type in ('trademark','patent','copyright','design','trade_secret','domain','software','framework','other')),
      description     text,
      status          text not null default 'active'
        check (status in ('active','pending','expired','abandoned','licensed')),
      jurisdiction    text[] default '{}',
      filing_date     date,
      registration_no text,
      renewal_date    date,
      owner_entity    text,
      notes           text,
      tags            text[] default '{}',
      created_at      timestamptz default now(),
      updated_at      timestamptz default now()
    );
    alter table public.ip_assets enable row level security;
    drop policy if exists "ip_assets_owner" on public.ip_assets;
    create policy "ip_assets_owner" on public.ip_assets using (user_id = auth.uid());
  `)

  await run('M019_contracts', `
    create table if not exists public.contracts (
      id              uuid primary key default uuid_generate_v4(),
      tenant_id       uuid references public.tenants(id) on delete cascade,
      user_id         uuid references auth.users(id) on delete cascade,
      title           text not null,
      contract_type   text default 'service',
      counterparty    text,
      status          text not null default 'active'
        check (status in ('draft','active','expired','terminated','renewed')),
      start_date      date,
      end_date        date,
      renewal_date    date,
      value           numeric,
      currency        text default 'GBP',
      description     text,
      tags            text[] default '{}',
      created_at      timestamptz default now(),
      updated_at      timestamptz default now()
    );
    alter table public.contracts enable row level security;
    drop policy if exists "contracts_owner" on public.contracts;
    create policy "contracts_owner" on public.contracts using (user_id = auth.uid());
  `)

  await run('M019_financial_snapshots', `
    create table if not exists public.financial_snapshots (
      id           uuid primary key default uuid_generate_v4(),
      tenant_id    uuid references public.tenants(id) on delete cascade,
      user_id      uuid references auth.users(id) on delete cascade,
      period       text not null,
      period_type  text not null default 'month' check (period_type in ('month','quarter','year')),
      entity       text not null default 'group',
      revenue      numeric default 0,
      expenses     numeric default 0,
      payroll_cost numeric default 0,
      gross_profit numeric generated always as (revenue - expenses - payroll_cost) stored,
      currency     text default 'GBP',
      cash_position numeric default 0,
      receivables  numeric default 0,
      payables     numeric default 0,
      notes        text,
      ai_commentary text,
      created_at   timestamptz default now()
    );
    alter table public.financial_snapshots enable row level security;
    drop policy if exists "financials_owner" on public.financial_snapshots;
    create policy "financials_owner" on public.financial_snapshots using (user_id = auth.uid());
  `)

  // ══ M020 ═══════════════════════════════════════════════════════════════════
  await run('M020_knowledge_entries', `
    create table if not exists public.knowledge_entries (
      id          uuid primary key default uuid_generate_v4(),
      tenant_id   uuid references public.tenants(id) on delete cascade,
      user_id     uuid references auth.users(id) on delete cascade,
      title       text not null,
      summary     text,
      full_text   text,
      entry_type  text not null default 'note',
      domain      text not null default 'business',
      source      text,
      url         text,
      tags        text[] default '{}',
      created_at  timestamptz default now(),
      updated_at  timestamptz default now()
    );
    alter table public.knowledge_entries enable row level security;
    drop policy if exists "knowledge_owner" on public.knowledge_entries;
    create policy "knowledge_owner" on public.knowledge_entries using (user_id = auth.uid());
  `)

  // ══ M021 ═══════════════════════════════════════════════════════════════════
  await run('M021_wellness_sessions', `
    create table if not exists public.wellness_sessions (
      id              uuid primary key default gen_random_uuid(),
      user_id         uuid not null references auth.users(id) on delete cascade,
      tenant_id       uuid references public.tenants(id) on delete cascade,
      session_date    date not null default current_date,
      session_type    text not null default 'morning_checkin',
      mood_score      smallint check (mood_score between 1 and 10),
      energy_score    smallint check (energy_score between 1 and 10),
      stress_score    smallint check (stress_score between 1 and 10),
      focus_score     smallint check (focus_score between 1 and 10),
      dominant_domain text,
      notes           text,
      tags            text[] default '{}',
      ai_insight      text,
      ai_recommended_actions jsonb default '[]',
      gdpr_consent    boolean not null default false,
      data_minimised  boolean not null default false,
      source          text default 'web',
      created_at      timestamptz default now(),
      updated_at      timestamptz default now()
    );
    alter table public.wellness_sessions enable row level security;
    drop policy if exists "wellness_sessions_owner" on public.wellness_sessions;
    create policy "wellness_sessions_owner" on public.wellness_sessions using (user_id = auth.uid());
  `)

  await run('M021_wellness_streaks', `
    create table if not exists public.wellness_streaks (
      id                  uuid primary key default gen_random_uuid(),
      user_id             uuid not null references auth.users(id) on delete cascade,
      streak_type         text not null default 'daily_checkin',
      current_streak      integer not null default 0,
      longest_streak      integer not null default 0,
      last_activity_date  date,
      streak_started_date date,
      created_at          timestamptz default now(),
      updated_at          timestamptz default now(),
      unique(user_id, streak_type)
    );
    alter table public.wellness_streaks enable row level security;
    drop policy if exists "wellness_streaks_owner" on public.wellness_streaks;
    create policy "wellness_streaks_owner" on public.wellness_streaks using (user_id = auth.uid());
  `)

  await run('M021_purpose_anchors', `
    create table if not exists public.purpose_anchors (
      id           uuid primary key default gen_random_uuid(),
      user_id      uuid not null references auth.users(id) on delete cascade,
      anchor_text  text not null,
      anchor_type  text not null default 'why',
      domain       text,
      is_primary   boolean default false,
      display_order smallint default 0,
      active       boolean default true,
      created_at   timestamptz default now()
    );
    alter table public.purpose_anchors enable row level security;
    drop policy if exists "purpose_anchors_owner" on public.purpose_anchors;
    create policy "purpose_anchors_owner" on public.purpose_anchors using (user_id = auth.uid());
  `)

  // ══ M022 ═══════════════════════════════════════════════════════════════════
  await run('M022_nemoclaw_calibration', `
    create table if not exists public.nemoclaw_calibration (
      id                     uuid primary key default gen_random_uuid(),
      user_id                uuid not null references auth.users(id) on delete cascade,
      education_level        text,
      education_detail       text,
      career_years           integer default 0,
      seniority_level        text,
      primary_industry       text,
      industries             text[] default '{}',
      skills                 text[] default '{}',
      qualifications         text[] default '{}',
      employers              text[] default '{}',
      key_achievements       text[] default '{}',
      communication_register text,
      coaching_intensity     text,
      recommended_frameworks text[] default '{}',
      growth_areas           text[] default '{}',
      strengths              text[] default '{}',
      work_life_signals      text,
      decision_style         text,
      calibration_summary    text,
      created_at             timestamptz default now(),
      updated_at             timestamptz default now(),
      unique(user_id)
    );
    alter table public.nemoclaw_calibration enable row level security;
    drop policy if exists "nemoclaw_cal_owner" on public.nemoclaw_calibration;
    create policy "nemoclaw_cal_owner" on public.nemoclaw_calibration using (user_id = auth.uid());
  `)

  // ══ M023 ═══════════════════════════════════════════════════════════════════
  await run('M023_exec_intelligence_config', `
    create table if not exists public.exec_intelligence_config (
      id          uuid primary key default gen_random_uuid(),
      user_id     uuid not null references auth.users(id) on delete cascade,
      persona     text default 'advisor',
      company_ctx text,
      goals       text[] default '{}',
      custom_inst text,
      tone        text default 'professional',
      response_style text default 'concise',
      created_at  timestamptz default now(),
      updated_at  timestamptz default now(),
      unique(user_id)
    );
    alter table public.exec_intelligence_config enable row level security;
    drop policy if exists "exec_intel_owner" on public.exec_intelligence_config;
    create policy "exec_intel_owner" on public.exec_intelligence_config using (user_id = auth.uid());
  `)

  // ══ User profiles RLS fix ══════════════════════════════════════════════════
  await run('M000_user_profiles_rls', `
    drop policy if exists "user_profiles_update" on public.user_profiles;
    create policy "user_profiles_update" on public.user_profiles
      for update using (id = auth.uid()) with check (id = auth.uid());
    drop policy if exists "user_profiles_insert" on public.user_profiles;
    create policy "user_profiles_insert" on public.user_profiles
      for insert with check (id = auth.uid());
  `)

  // ══ pios-cv storage bucket ═════════════════════════════════════════════════
  try {
    const bucketRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey':         SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ id: 'pios-cv', name: 'pios-cv', public: false }),
    })
    results['pios_cv_bucket'] = { ok: bucketRes.ok || bucketRes.status === 409, method: 'storage_api' }
  } catch (e: any) {
    results['pios_cv_bucket'] = { ok: false, error: e.message }
  }

  const passed = Object.values(results).filter((r: any) => r.ok).length
  const failed = Object.values(results).filter((r: any) => !r.ok).length

  return NextResponse.json({
    success: failed === 0,
    passed,
    failed,
    results,
    next: failed === 0
      ? 'All done. Now click Seed NemoClaw™ then Seed Demo Data.'
      : 'Some migrations failed — exec_sql RPC may need to be created manually in Supabase SQL Editor.',
  })
}
