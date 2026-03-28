export const dynamic    = 'force-dynamic'
export const maxDuration = 30
export const runtime    = 'nodejs'

/**
 * POST /api/admin/seed-nemoclaw
 * Explicit NemoClaw™ first-run seed for the authenticated user.
 *
 * Idempotent — safe to call multiple times. Skips steps already done.
 *
 * Steps:
 *   1. Seed exec_intelligence_config default (if not present)
 *   2. Seed 15 proprietary IP frameworks via ip-vault/seed_frameworks
 *   3. Bootstrap nemoclaw_calibration placeholder row (if not present)
 *
 * Used by: setup guide, smoke test verification, manual re-seed.
 *
 * PIOS v3.0.3 Sprint 85 | VeritasIQ Technologies Ltd
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: prof } = await (supabase as any)
      .from('user_profiles')
      .select('tenant_id, full_name, job_title, persona_type, organisation')
      .eq('id', user.id)
      .single()

    const p = prof as any
    if (!p?.tenant_id) {
      return NextResponse.json({ error: 'No tenant found — complete onboarding first' }, { status: 400 })
    }

    const steps: Record<string, { ok: boolean; detail: string; skipped?: boolean }> = {}

    // ── Step 1: exec_intelligence_config default ─────────────────────────────
    try {
      const { data: existing } = await (supabase as any)
        .from('exec_intelligence_config')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (existing) {
        steps.exec_intel_config = { ok: true, detail: 'Already configured', skipped: true }
      } else {
        const { error } = await (supabase as any)
          .from('exec_intelligence_config')
          .insert({
            user_id:             user.id,
            focus_areas:         ['strategy', 'product', 'commercial', 'operations'],
            risk_tolerance:      'moderate',
            decision_horizon:    'medium_term',
            briefing_frequency:  'daily',
            ai_persona_mode:     'advisor',
            custom_instructions: `You are NemoClaw™, the proprietary AI executive intelligence engine built by VeritasIQ Technologies Ltd for ${p.full_name ?? 'the user'}. You operate as a trusted strategic advisor. You understand the 13 proprietary VeritasIQ frameworks (SDL, POM, OAE, CVDM, CPA, UMS, VFO, CFE, ADF, GSM, SPA, RTE, IML). Always reference the most relevant framework when structuring analysis. Be direct, precise, and action-oriented.`,
            active:              true,
          })
        if (error) throw error
        steps.exec_intel_config = { ok: true, detail: 'exec_intelligence_config default seeded' }
      }
    } catch (e: any) {
      steps.exec_intel_config = { ok: false, detail: e.message ?? 'exec_intelligence_config seed failed' }
    }

    // ── Step 2: IP framework seed (15 proprietary frameworks) ────────────────
    try {
      const origin = req.headers.get('origin')
        ?? req.headers.get('x-forwarded-host')?.replace(/^/, 'https://')
        ?? process.env.NEXTAUTH_URL
        ?? 'https://pios-wysskz48mv-engs-projects.vercel.app'

      const seedRes = await fetch(`${origin}/api/ip-vault`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie':        req.headers.get('cookie') ?? '',
        },
        body: JSON.stringify({ action: 'seed_frameworks' }),
      })

      if (seedRes.ok) {
        const d = await seedRes.json() as { seeded?: number; skipped?: number }
        steps.ip_frameworks = {
          ok:      true,
          detail:  d.seeded === 0
            ? `All ${d.skipped ?? 15} frameworks already seeded`
            : `Seeded ${d.seeded} frameworks (${d.skipped ?? 0} already present)`,
          skipped: d.seeded === 0,
        }
      } else {
        const err = await seedRes.text().catch(() => 'unknown')
        steps.ip_frameworks = { ok: false, detail: `ip-vault seed_frameworks failed: ${err.slice(0, 200)}` }
      }
    } catch (e: any) {
      steps.ip_frameworks = { ok: false, detail: e.message ?? 'Framework seed failed' }
    }

    // ── Step 3: nemoclaw_calibration placeholder ─────────────────────────────
    try {
      const { data: existing } = await (supabase as any)
        .from('nemoclaw_calibration')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_current', true)
        .single()

      if (existing) {
        steps.nemoclaw_calibration = { ok: true, detail: 'Calibration record already exists', skipped: true }
      } else {
        const { error } = await (supabase as any)
          .from('nemoclaw_calibration')
          .insert({
            user_id:             user.id,
            calibration_version: 1,
            cv_summary:          `${p.full_name ?? 'User'} — ${p.job_title ?? 'Professional'} at ${p.organisation ?? 'VeritasIQ Technologies Ltd'}. Calibration pending — upload CV at /platform/ai to activate full NemoClaw™ intelligence.`,
            key_skills:          ['strategy', 'commercial', 'leadership', 'consulting'],
            seniority_level:     'senior',
            domain_focus:        ['saas', 'fm_consulting', 'investment'],
            calibration_data:    {
              persona:      p.persona_type ?? 'professional',
              bootstrapped: true,
              note:         'Placeholder calibration — full calibration requires CV upload',
            },
            calibration_score: 0.40,
            is_current:       true,
          })
        if (error) throw error
        steps.nemoclaw_calibration = {
          ok:     true,
          detail: 'NemoClaw calibration placeholder created — upload CV at /platform/ai to complete full calibration',
        }
      }
    } catch (e: any) {
      steps.nemoclaw_calibration = { ok: false, detail: e.message ?? 'Calibration seed failed' }
    }

    const allOk  = Object.values(steps).every(s => s.ok)
    const failed = Object.entries(steps).filter(([, s]) => !s.ok).map(([k]) => k)

    return NextResponse.json({
      ok: allOk,
      steps,
      failed,
      message: allOk
        ? 'NemoClaw™ seed complete. Visit /platform/ai to upload your CV for full calibration.'
        : `NemoClaw seed partially failed: ${failed.join(', ')}`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint:    'POST /api/admin/seed-nemoclaw',
    description: 'NemoClaw™ first-run seed — exec_intelligence_config + IP frameworks + calibration placeholder',
    idempotent:  true,
    auth:        'Requires logged-in session',
  })
}
