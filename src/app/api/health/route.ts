/**
 * GET /api/health — PIOS platform health check
 * PIOS v2.2 | VeritasIQ Technologies Ltd
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const obs = {
    sentry:       process.env.SENTRY_DSN                                              ? 'configured' : 'not-set',
    resend_email: process.env.RESEND_API_KEY                                          ? 'configured' : 'not-set -- supervisor alerts disabled',
    cron_secret:  process.env.CRON_SECRET                                             ? 'configured' : 'not-set -- cron jobs disabled',
    upstash:      (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ? 'configured' : 'in-memory-fallback',
    sla_target:   '99.5%',
  }
  const start = Date.now()
  let dbStatus = 'ok'
  let dbLatencyMs = 0
  try {
    const supabase = createClient()
    const t = Date.now()
    await supabase.from('user_profiles').select('id').limit(1)
    dbLatencyMs = Date.now() - t
  } catch { dbStatus = 'error' }

  return NextResponse.json({
    observability: obs,
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    version: '1.0.0',
    product: 'PIOS',
    owner: 'VeritasIQ Technologies Ltd',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: dbStatus, latency_ms: dbLatencyMs },
      api: { status: 'ok', latency_ms: Date.now() - start },
    },
  }, { status: dbStatus === 'ok' ? 200 : 503 })
}
