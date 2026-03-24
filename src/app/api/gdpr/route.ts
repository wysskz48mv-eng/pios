/**
 * POST /api/gdpr   body: { action: 'export' | 'erase' }
 * GET  /api/gdpr   — data subject summary
 *
 * PIOS™ GDPR Compliance — ISO 27001 A.18.1
 * Art.15 Right of Access | Art.17 Right to Erasure | Art.20 Portability
 *
 * PIOS v2.4.4 | Sprint 58 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const TABLES = [
  { table: 'user_profiles',          pii: ['full_name','avatar_url','google_email','phone'] },
  { table: 'tasks',                   pii: ['title','description'] },
  { table: 'projects',               pii: ['title','description'] },
  { table: 'calendar_events',        pii: ['title','description','location','attendees'] },
  { table: 'emails',                 pii: ['from_email','from_name','subject','snippet'] },
  { table: 'connected_email_accounts',pii: ['email_address','display_name'] },
  { table: 'expenses',               pii: ['description','merchant'] },
  { table: 'nps_survey_responses',   pii: ['open_feedback'] },
] as const

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const summary: Record<string, number> = {}
  for (const { table } of TABLES) {
    const { count } = await supabase
      .from(table).select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    summary[table] = count ?? 0
  }

  return NextResponse.json({
    subject:  user.email,
    user_id:  user.id,
    summary,
    rights: {
      access:  'POST /api/gdpr { action: "export" }',
      erasure: 'POST /api/gdpr { action: "erase", confirm: "ERASE MY DATA" }',
    },
    controller:  'VeritasIQ Technologies Ltd, United Kingdom',
    dpo_contact: 'privacy@veritasiq.co.uk',
  })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json().catch(() => null).catch(() => ({})) as Record<string,unknown>
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  const action = String(body.action ?? '')

  if (action === 'export') {
    const exported: Record<string, unknown> = {
      _meta: {
        subject:     user.email,
        export_date: new Date().toISOString(),
        controller:  'VeritasIQ Technologies Ltd',
        legal_basis: 'Art.15 GDPR — Right of Access',
      },
    }
    for (const { table } of TABLES) {
      const { data } = await supabase.from(table).select('*').eq('user_id', user.id).limit(500)
      exported[table] = data ?? []
    }
    return new NextResponse(JSON.stringify(exported, null, 2), {
      headers: {
        'Content-Type':        'application/json',
        'Content-Disposition': `attachment; filename="pios-data-export-${new Date().toISOString().slice(0,10)}.json"`,
      },
    })
  }

  if (action === 'erase') {
    if (String(body.confirm ?? '') !== 'ERASE MY DATA') {
      return NextResponse.json({
        error: 'Confirmation required',
        hint:  'Include { "confirm": "ERASE MY DATA" } to confirm',
      }, { status: 400 })
    }

    const deletable = ['tasks','projects','calendar_events','emails','expenses','connected_email_accounts','nps_survey_responses']
    const results: Record<string,string> = {}
    for (const table of deletable) {
      const { error, count } = await supabase.from(table).delete().eq('user_id', user.id)
      results[table] = error ? `error: ${error.message}` : `deleted ${count ?? 0}`
    }

    // Pseudonymise profile
    await supabase.from('user_profiles').update({
      full_name: '[Deleted User]', avatar_url: null,
      google_email: null, google_access_token: null, google_refresh_token: null,
    }).eq('id', user.id)
    results.profile = 'pseudonymised'

    return NextResponse.json({
      ok: true, action: 'erasure',
      legal_basis: 'Art.17 GDPR — Right to Erasure',
      completed: new Date().toISOString(), results,
    })
  }

  return NextResponse.json({ error: 'action must be "export" or "erase"' }, { status: 400 })
}
