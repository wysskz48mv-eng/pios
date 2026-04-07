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

const HEALTH_DETAIL_HEADER = 'x-health-secret'

interface Check {
  name:    string
  status:  'ok' | 'warn' | 'fail'
  detail?: string
  ms?:     number
}

interface TableGroup {
  name: string
  candidates: string[]
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
  const tableGroups: TableGroup[] = [
    { name: 'user_profiles', candidates: ['user_profiles'] },
    { name: 'tasks', candidates: ['tasks'] },
    { name: 'okrs', candidates: ['exec_okrs', 'okrs'] },
    { name: 'decisions', candidates: ['executive_decisions', 'decisions'] },
    { name: 'wellness_sessions', candidates: ['wellness_sessions'] },
    { name: 'wellness_streaks', candidates: ['wellness_streaks'] },
    { name: 'nemoclaw_calibration', candidates: ['nemoclaw_calibration'] },
    { name: 'exec_intelligence_config', candidates: ['exec_intelligence_config'] },
    { name: 'morning_briefs', candidates: ['morning_briefs'] },
    { name: 'ip_assets', candidates: ['ip_assets'] },
    { name: 'contracts', candidates: ['contracts'] },
    { name: 'financial_snapshots', candidates: ['financial_snapshots'] },
    { name: 'knowledge_entries', candidates: ['knowledge_entries'] },
    { name: 'content_series', candidates: ['content_series'] },
    { name: 'content_episodes', candidates: ['content_episodes'] },
    { name: 'stakeholders', candidates: ['stakeholders'] },
    { name: 'publications', candidates: ['publications'] },
  ]

  const checks: Check[] = []
  for (const group of tableGroups) {
    const t0 = Date.now()
    let matchedTable: string | null = null
    let lastError: string | undefined

    for (const candidate of group.candidates) {
      const { error } = await sb.from(candidate).select('id').limit(1)
      if (!error) {
        matchedTable = candidate
        break
      }
      lastError = `${error.code}: ${error.message.slice(0, 80)}`
    }

    checks.push({
      name:   `table:${group.name}`,
      status: matchedTable ? 'ok' : 'fail',
      detail: matchedTable
        ? (matchedTable === group.name ? undefined : `using schema-compatible table ${matchedTable}`)
        : lastError,
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
    { key: 'STRIPE_PRICE_STUDENT',     critical: false },
    { key: 'STRIPE_PRICE_PRO',         critical: false },
    { key: 'STRIPE_PRICE_PROFESSIONAL', critical: false },
    { key: 'STRIPE_PRICE_TEAM',        critical: false },
    { key: 'SUPABASE_DB_POOLER_URL',     critical: false },
  ]

  return vars.map(v => ({
    name:   `env:${v.key}`,
    status: process.env[v.key] ? 'ok' : (v.critical ? 'fail' : 'warn'),
    detail: process.env[v.key] ? undefined : v.critical ? 'MISSING — critical' : 'not set — optional',
  } as Check))
}

function canViewDetailedHealth(request: Request): boolean {
  const secret = request.headers.get(HEALTH_DETAIL_HEADER)
  const allowedSecrets = [process.env.ADMIN_SECRET, process.env.CRON_SECRET].filter(Boolean)

  if (!secret || allowedSecrets.length === 0) return false
  return allowedSecrets.includes(secret)
}

export async function GET(request: Request) {
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
    canViewDetailedHealth(request)
      ? {
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
      }
      : {
      ok: overallOk,
      status: overallOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - t0,
    },
    { status: overallOk ? 200 : 503 }
  )
}
