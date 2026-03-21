/**
 * GET /api/health — PIOS platform health check
 * PIOS v1.0 | VeritasIQ Technologies Ltd
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
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
