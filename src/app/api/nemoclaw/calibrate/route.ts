/**
 * POST /api/nemoclaw/calibrate
 * Persists CV-extracted calibration + behavioural signals.
 *
 * NemoClaw™ Progressive Profiling Architecture:
 *
 * Signal Layer 1 — Self-declared (CV, onboarding) confidence 0.2
 *   → Stored in nemoclaw_calibration from /api/cv extraction
 *
 * Signal Layer 2 — Behavioural (platform activity) confidence 0.7
 *   → Task taxonomy, framework usage, OKR structure, writing patterns
 *   → Accumulated automatically, never requires user action
 *
 * Signal Layer 3 — Connected evidence (Gmail, Drive) confidence 0.85
 *   → Email register, meeting counterparties, document types
 *   → Added as OAuth scopes are connected
 *
 * Signal Layer 4 — Challenge-based (profiling sessions) confidence 0.95
 *   → Scenario responses scored by Claude
 *   → Triggered from /platform/ai/train
 *
 * The wizard is domain-neutral. An FM consultant, a marketing advisor,
 * and a biotech researcher all select "Consultant" — NemoClaw infers
 * domain from evidence, never from a hardcoded persona picker.
 *
 * PIOS v3.2.0 | VeritasIQ Technologies Ltd
 */
import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { calibration, source = 'cv_upload', signal_layer = 1 } = body

  if (!calibration) return NextResponse.json({ error: 'No calibration data' }, { status: 400 })

  // Confidence weights by signal layer
  const CONFIDENCE: Record<number, number> = { 1: 0.2, 2: 0.7, 3: 0.85, 4: 0.95 }
  const confidence = CONFIDENCE[signal_layer] ?? 0.2

  try {
    // Persist to nemoclaw_calibration
    await supabase.from('nemoclaw_calibration').upsert({
      user_id:                user.id,
      education_level:        calibration.education_level        ?? null,
      education_detail:       calibration.education_detail       ?? null,
      career_years:           calibration.career_years           ?? 0,
      seniority_level:        calibration.seniority_level        ?? null,
      primary_industry:       calibration.primary_industry       ?? null,
      industries:             calibration.industries             ?? [],
      skills:                 calibration.skills                 ?? [],
      qualifications:         calibration.qualifications         ?? [],
      employers:              calibration.employers              ?? [],
      key_achievements:       calibration.key_achievements       ?? [],
      communication_register: calibration.communication_register ?? 'professional',
      coaching_intensity:     calibration.coaching_intensity     ?? 'moderate',
      recommended_frameworks: calibration.recommended_frameworks ?? [],
      growth_areas:           calibration.growth_areas           ?? [],
      strengths:              calibration.strengths              ?? [],
      work_life_signals:      calibration.work_life_signals      ?? null,
      decision_style:         calibration.decision_style         ?? null,
      calibration_summary:    calibration.calibration_summary    ?? null,
      updated_at:             new Date().toISOString(),
    }, { onConflict: 'user_id' })

    await supabase.rpc('evaluate_calibration_gates', { p_user_id: user.id })

    // Build context summary — purely from evidence, no hardcoded domains
    // NemoClaw receives whatever the signal layer provided.
    // Layer 1 (CV): job history vocabulary
    // Layer 2 (behaviour): task/OKR/framework patterns
    // Layer 3 (connected): email register, counterparty graph
    // Layer 4 (challenge): scenario response quality
    const contextParts = [
      calibration.calibration_summary,
      calibration.primary_industry && `Industry: ${calibration.primary_industry}`,
      calibration.seniority_level  && `Level: ${calibration.seniority_level}`,
      calibration.career_years     && `Experience: ${calibration.career_years}yr`,
      (calibration.skills ?? []).slice(0, 6).join(', '),
    ].filter(Boolean)

    const contextSummary = contextParts.length > 0
      ? `[L${signal_layer} confidence:${confidence}] ${contextParts.join('. ')}`
      : null

    if (contextSummary) {
      await supabase.from('exec_intelligence_config').upsert({
        user_id:    user.id,
        company_ctx: contextSummary,
        tone:       calibration.communication_register ?? 'professional',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    }

    return NextResponse.json({
      ok:         true,
      source,
      signal_layer,
      confidence,
      industry:   calibration.primary_industry ?? null,
      frameworks: calibration.recommended_frameworks ?? [],
    })
  } catch (e: any) {
    return apiError(e)
  }
}
