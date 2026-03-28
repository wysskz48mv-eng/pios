import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/health
 * System health check — verifies all critical subsystems.
 * Used by:
 *   - /platform/admin health panel
 *   - Vercel deployment smoke test
 *   - External monitoring (UptimeRobot etc.)
 * 
 * Returns 200 if all critical checks pass.
 * Returns 503 if any critical check fails.
 * VeritasIQ Technologies Ltd · PIOS
 */

export const dynamic = 'force-dynamic'

interface Check {
  name:    string
  status:  'ok' | 'warn' | 'fail'
  detail?: string
  ms?:     number
}

async function checkDB(): Promise<Check> {
  const t0 = Date.now()
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { name: 'database', status: 'fail', detail: 'Supabase env vars missing' }

    const sb = createClient(url, key)
    const { error } = await sb.from('user_profiles').select('id').limit(1)
    if (error) return { name: 'database', status: 'fail', detail: error.message, ms: Date.now() - t0 }
    return { name: 'database', status: 'ok', ms: Date.now() - t0 }
  } catch (e: unknown) {
    return { name: 'database', status: 'fail', detail: String(e), ms: Date.now() - t0 }
  }
}

async function checkExecSQL(): Promise<Check> {
  const t0 = Date.now()
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { name: 'exec_sql_rpc', status: 'fail', detail: 'Supabase env vars missing' }

    const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, 'apikey': key },
      body: JSON.stringify({ sql_query: 'SELECT 1' }),
    })
    if (res.ok) return { name: 'exec_sql_rpc', status: 'ok', ms: Date.now() - t0 }
    return { name: 'exec_sql_rpc', status: 'fail', detail: 'RPC not found — run 00_create_exec_sql_rpc.sql', ms: Date.now() - t0 }
  } catch (e: unknown) {
    return { name: 'exec_sql_rpc', status: 'fail', detail: String(e), ms: Date.now() - t0 }
  }
}

async function checkTables(): Promise<Check[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return [{ name: 'tables', status: 'fail', detail: 'Supabase env vars missing' }]

  const sb = createClient(url, key)
  const criticalTables = [
    'user_profiles', 'tasks', 'okrs', 'decisions',
    'wellness_sessions', 'wellness_streaks',
    'nemoclaw_calibration', 'exec_intelligence_config',
    'morning_briefs', 'ip_assets', 'contracts',
    'financial_snapshots', 'knowledge_entries',
    'content_series', 'content_episodes',
    'stakeholders', 'publications',
  ]

  const checks: Check[] = []
  for (const table of criticalTables) {
    const t0 = Date.now()
    const { error } = await sb.from(table).select('id').limit(1)
    checks.push({
      name:   `table:${table}`,
      status: error ? 'fail' : 'ok',
      detail: error ? `${error.code}: ${error.message.slice(0, 80)}` : undefined,
      ms:     Date.now() - t0,
    })
  }
  return checks
}

function checkEnvVars(): Check[] {
  const vars = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL',   critical: true  },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', critical: true },
    { key: 'SUPABASE_SERVICE_ROLE_KEY',  critical: true  },
    { key: 'ANTHROPIC_API_KEY',          critical: true  },
    { key: 'RESEND_API_KEY',             critical: false },
    { key: 'CRON_SECRET',                critical: false },
    { key: 'ADMIN_SECRET',               critical: false },
    { key: 'STRIPE_SECRET_KEY',          critical: false },
    { key: 'STRIPE_WEBHOOK_SECRET',      critical: false },
    { key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', critical: false },
    { key: 'NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID', critical: false },
    { key: 'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID',     critical: false },
    { key: 'SUPABASE_DB_POOLER_URL',     critical: false },
  ]

  return vars.map(v => ({
    name:   `env:${v.key}`,
    status: process.env[v.key] ? 'ok' : (v.critical ? 'fail' : 'warn'),
    detail: process.env[v.key] ? undefined : v.critical ? 'MISSING — critical' : 'not set — optional',
  } as Check))
}

export async function GET() {
  const t0 = Date.now()

  const [db, execSQL, tables, envChecks] = await Promise.all([
    checkDB(),
    checkExecSQL(),
    checkTables(),
    Promise.resolve(checkEnvVars()),
  ])

  const all: Check[] = [db, execSQL, ...tables, ...envChecks]
  const failed   = all.filter(c => c.status === 'fail')
  const warned   = all.filter(c => c.status === 'warn')
  const critFailed = [db, execSQL, ...envChecks.filter(e => e.detail?.includes('critical'))]
    .filter(c => c.status === 'fail')

  const overallOk = critFailed.length === 0

  return NextResponse.json(
    {
      ok:        overallOk,
      status:    overallOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - t0,
      summary: {
        total:    all.length,
        ok:       all.filter(c => c.status === 'ok').length,
        warnings: warned.length,
        failures: failed.length,
      },
      critical_failures: critFailed.filter(c => c.status === 'fail').map(c => c.name),
      checks: all,
    },
    { status: overallOk ? 200 : 503 }
  )
}
