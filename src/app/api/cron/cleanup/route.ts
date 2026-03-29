/**
 * GET /api/cron/cleanup
 * GDPR Art.5(e) — Storage limitation enforcement
 * Deletes ai_sessions >90 days, profiling_signals >180 days, read notifications >30 days.
 * PIOS v3.2.0 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  } catch (err: any) {
    console.error('[PIOS cron/cleanup]', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
  try {
  const secret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const d90  = new Date(Date.now() - 90  * 86400000).toISOString()
  const d180 = new Date(Date.now() - 180 * 86400000).toISOString()
  const d30  = new Date(Date.now() - 30  * 86400000).toISOString()
  const [s, p, n] = await Promise.all([
    supabase.from('ai_sessions').delete().lt('created_at', d90),
    supabase.from('profiling_signals').delete().lt('created_at', d180),
    supabase.from('notifications').delete().lt('created_at', d30).eq('read', true),
  ])
  return NextResponse.json({ ok: true, deleted: { ai_sessions: !s.error, profiling_signals: !p.error, notifications: !n.error } })
}
