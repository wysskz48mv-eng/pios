import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOwnerEmail } from '@/lib/security/route-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ownerErr = requireOwnerEmail(user.email)
  if (ownerErr) return ownerErr

  const adminSecret = process.env.ADMIN_SECRET ?? process.env.SEED_SECRET
  if (!adminSecret) {
    return NextResponse.json({
      ok: false,
      error: 'ADMIN_SECRET or SEED_SECRET not configured',
    }, { status: 500 })
  }

  const endpoint = new URL('/api/cron/citation-graph', req.nextUrl.origin).toString()

  try {
    const trigger = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-admin-secret': adminSecret,
      },
      cache: 'no-store',
    })

    const payload = await trigger.json().catch(() => ({}))

    if (!trigger.ok) {
      return NextResponse.json({
        ok: false,
        upstream_status: trigger.status,
        error: payload?.error ?? 'Manual trigger failed',
        result: payload,
      }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      triggered_at: new Date().toISOString(),
      result: payload,
    })
  } catch (error: unknown) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Manual trigger failed',
    }, { status: 500 })
  }
}
