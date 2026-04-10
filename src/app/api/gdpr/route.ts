/**
 * POST /api/gdpr   body: { action: 'export' | 'erase' | 'erase_wellness' }
 * GET  /api/gdpr   — data subject summary
 *
 * PIOS™ GDPR Compliance — ISO 27001 A.18.1
 * Art.15 Right of Access | Art.17 Right to Erasure | Art.20 Portability
 *
 * Sprint 80: added M019/M020/M021 tables (ip_assets, contracts,
 * financial_snapshots, knowledge_entries, wellness_sessions,
 * wellness_streaks, wellness_patterns, purpose_anchors)
 *
 * PIOS v3.0 | Sprint 80 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const TABLES = [
  // Core
  { table: 'user_profiles',            pii: ['full_name','avatar_url','google_email','phone'] },
  { table: 'tasks',                     pii: ['title','description'] },
  { table: 'projects',                 pii: ['title','description'] },
  { table: 'calendar_events',          pii: ['title','description','location','attendees'] },
  { table: 'emails',                   pii: ['from_email','from_name','subject','snippet'] },
  { table: 'connected_email_accounts', pii: ['email_address','display_name'] },
  { table: 'expenses',                 pii: ['description','merchant'] },
  { table: 'nps_survey_responses',     pii: ['open_feedback'] },
  // M019 — IP Vault, Contracts, Financials
  { table: 'ip_assets',                pii: ['name','description','notes'] },
  { table: 'contracts',                pii: ['title','counterparty','key_terms','obligations','notes'] },
  { table: 'financial_snapshots',      pii: ['notes','ai_commentary'] },
  // M020 — Knowledge Base
  { table: 'knowledge_entries',        pii: ['title','summary','full_text'] },
  // M021 — Wellness (special handling — GDPR Art.9 special category)
  { table: 'wellness_sessions',        pii: ['notes','ai_insight','ai_recommended_actions'] },
  { table: 'wellness_streaks',         pii: [] },
  { table: 'wellness_patterns',        pii: ['pattern_label','pattern_data'] },
  { table: 'purpose_anchors',          pii: ['anchor_text'] },
] as const

// Tables safe to bulk-delete (no FK constraints to other user data)
const DELETABLE = [
  'tasks','projects','calendar_events','emails','expenses',
  'connected_email_accounts','nps_survey_responses',
  'ip_assets','contracts','financial_snapshots','knowledge_entries',
  'wellness_sessions','wellness_streaks','wellness_patterns','purpose_anchors',
]

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const summary: Record<string, number> = {}
  for (const { table } of TABLES) {
    try {
      const { count } = await (supabase as any)
        .from(table).select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      summary[table] = count ?? 0
    } catch {
      summary[table] = -1 // table may not exist yet
    }
  }

  // Wellness-specific: count sessions with gdpr_consent = true
  try {
    const { count: consentedCount } = await (supabase as any)
      .from('wellness_sessions').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('gdpr_consent', true)
    summary['wellness_sessions_consented'] = consentedCount ?? 0
  } catch { /* table not yet created */ }

  return NextResponse.json({
    subject:  user.email,
    user_id:  user.id,
    summary,
    special_category_data: {
      wellness: 'Wellness check-in data is classified as health data under GDPR Art.9. It is stored only where you have given explicit consent (gdpr_consent=true) and is accessible only to you via RLS policies.',
    },
    rights: {
      access:           'POST /api/gdpr { action: "export" }',
      erasure:          'POST /api/gdpr { action: "erase", confirm: "ERASE MY DATA" }',
      wellness_erasure: 'POST /api/gdpr { action: "erase_wellness", confirm: "ERASE WELLNESS DATA" }',
    },
    controller:  'VeritasIQ Technologies Ltd, United Kingdom',
    dpo_contact: 'info@veritasiq.io',
    legal_bases: {
      standard_data:  'Art.6(1)(b) — contract performance',
      wellness_data:  'Art.9(2)(a) — explicit consent',
    },
  })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json() as Record<string,unknown>
  const action = String(body.action ?? '')

  // ── Export ────────────────────────────────────────────────────────────────
  if (action === 'export') {
    const exported: Record<string, unknown> = {
      _meta: {
        subject:         user.email,
        export_date:     new Date().toISOString(),
        controller:      'VeritasIQ Technologies Ltd',
        legal_basis:     'Art.15 GDPR — Right of Access',
        special_category: 'Wellness data included where explicit consent was given (Art.9(2)(a))',
      },
    }
    for (const { table } of TABLES) {
      try {
        const { data } = await (supabase as any).from(table).select('*').eq('user_id', user.id).limit(500)
        exported[table] = data ?? []
      } catch {
        exported[table] = []
      }
    }
    return new NextResponse(JSON.stringify(exported, null, 2), {
      headers: {
        'Content-Type':        'application/json',
        'Content-Disposition': `attachment; filename="pios-data-export-${new Date().toISOString().slice(0,10)}.json"`,
      },
    })
  }

  // ── Wellness-only erase (Art.17 — granular) ───────────────────────────────
  if (action === 'erase_wellness') {
    if (String(body.confirm ?? '') !== 'ERASE WELLNESS DATA') {
      return NextResponse.json({
        error: 'Confirmation required',
        hint:  'Include { "confirm": "ERASE WELLNESS DATA" } to confirm',
      }, { status: 400 })
    }
    const wellnessTables = ['wellness_sessions','wellness_streaks','wellness_patterns','purpose_anchors']
    const results: Record<string,string> = {}
    for (const table of wellnessTables) {
      try {
        const { error, count } = await (supabase as any).from(table).delete().eq('user_id', user.id)
        results[table] = error ? `error: ${error.message}` : `deleted ${count ?? 0}`
      } catch {
        results[table] = 'table not yet created'
      }
    }
    return NextResponse.json({
      ok: true, action: 'wellness_erasure',
      legal_basis: 'Art.17 GDPR — Right to Erasure (special category health data)',
      completed:   new Date().toISOString(), results,
    })
  }

  // ── Full erase ────────────────────────────────────────────────────────────
  if (action === 'erase') {
    if (String(body.confirm ?? '') !== 'ERASE MY DATA') {
      return NextResponse.json({
        error: 'Confirmation required',
        hint:  'Include { "confirm": "ERASE MY DATA" } to confirm',
      }, { status: 400 })
    }
    const results: Record<string,string> = {}
    for (const table of DELETABLE) {
      try {
        const { error, count } = await (supabase as any).from(table).delete().eq('user_id', user.id)
        results[table] = error ? `error: ${error.message}` : `deleted ${count ?? 0}`
      } catch {
        results[table] = 'table not yet created'
      }
    }
    // Pseudonymise profile
    await supabase.from('user_profiles').update({
      full_name: '[Deleted User]', avatar_url: null,
      google_email: null, google_access_token_enc: null, google_refresh_token_enc: null,
    }).eq('id', user.id)
    results.profile = 'pseudonymised'

    return NextResponse.json({
      ok: true, action: 'erasure',
      legal_basis: 'Art.17 GDPR — Right to Erasure',
      completed:   new Date().toISOString(), results,
    })
  }

  return NextResponse.json({ error: 'action must be "export", "erase_wellness", or "erase"' }, { status: 400 })
}
