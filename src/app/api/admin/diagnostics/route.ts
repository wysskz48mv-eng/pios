/**
 * GET /api/admin/diagnostics?type=findings|runs|patterns
 * Returns diagnostic data for the admin dashboard.
 * PIOS v3.7.2 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { requireOwnerEmail } from '@/lib/security/route-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ownerErr = requireOwnerEmail(user.email)
  if (ownerErr) return ownerErr

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const type = req.nextUrl.searchParams.get('type') ?? 'findings'

  if (type === 'findings') {
    const { data } = await admin
      .from('pios_diagnostics')
      .select('*')
      .order('severity')
      .order('last_seen_at', { ascending: false })
      .limit(100)
    return NextResponse.json({ findings: data ?? [] })
  }

  if (type === 'runs') {
    const { data } = await admin
      .from('pios_diagnostic_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20)
    return NextResponse.json({ runs: data ?? [] })
  }

  if (type === 'patterns') {
    const { data } = await admin
      .from('pios_diagnostic_patterns')
      .select('*')
      .order('times_detected', { ascending: false })
    return NextResponse.json({ patterns: data ?? [] })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
