import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getPersonaCalibrationConfig } from '@/lib/onboarding/persona-calibration'

export const dynamic = 'force-dynamic'

function clampStep(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 1
  return Math.min(6, Math.max(1, Math.round(n)))
}

export async function GET() {
  try {
    const supabase = createClient()
    const admin = createServiceClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: profile }, { data: stateRow }, { data: calibration }] = await Promise.all([
      admin
        .from('user_profiles')
        .select('id,full_name,job_title,organisation,persona_type,onboarding_complete,onboarding_current_step,onboarded')
        .eq('id', user.id)
        .maybeSingle(),
      admin
        .from('onboarding_state')
        .select('user_id,current_step,step_history,persona_selected,calibration_answers,cv_uploaded,cv_analyzed,cv_skipped,onboarding_complete,started_at,completed_at,last_seen_at,updated_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      admin
        .from('nemoclaw_calibration')
        .select('communication_register,coaching_intensity,recommended_frameworks,competency_scores,top_competencies,cv_profile_summary,updated_at')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    const mergedComplete = Boolean(stateRow?.onboarding_complete ?? profile?.onboarding_complete ?? profile?.onboarded)
    const personaSelected = stateRow?.persona_selected ?? profile?.persona_type ?? null

    const ensuredStep = mergedComplete
      ? 6
      : Math.max(clampStep(stateRow?.current_step ?? profile?.onboarding_current_step ?? 1), personaSelected ? 2 : 1)

    if (!stateRow) {
      await admin.from('onboarding_state').upsert({
        user_id: user.id,
        current_step: ensuredStep,
        persona_selected: personaSelected,
        onboarding_complete: mergedComplete,
        last_seen_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    } else {
      await admin.from('onboarding_state').update({
        current_step: ensuredStep,
        onboarding_complete: mergedComplete,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id)
    }

    const calibrationConfig = getPersonaCalibrationConfig(personaSelected)

    return NextResponse.json({
      ok: true,
      profile: profile ?? null,
      state: {
        ...(stateRow ?? {}),
        current_step: ensuredStep,
        onboarding_complete: mergedComplete,
        persona_selected: personaSelected,
      },
      calibration: calibration ?? null,
      persona_config: calibrationConfig,
    })
  } catch (error) {
    console.error('[onboarding/state] GET', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient()
    const admin = createServiceClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const nextStep = clampStep(body.current_step)
    const now = new Date().toISOString()

    const payload: Record<string, unknown> = {
      user_id: user.id,
      current_step: nextStep,
      last_seen_at: now,
      updated_at: now,
      created_at: now,
    }

    if (typeof body.persona_selected === 'string' && body.persona_selected.trim()) payload.persona_selected = body.persona_selected.trim()
    if (typeof body.cv_uploaded === 'boolean') payload.cv_uploaded = body.cv_uploaded
    if (typeof body.cv_analyzed === 'boolean') payload.cv_analyzed = body.cv_analyzed
    if (typeof body.cv_skipped === 'boolean') payload.cv_skipped = body.cv_skipped
    if (typeof body.onboarding_complete === 'boolean') {
      payload.onboarding_complete = body.onboarding_complete
      payload.completed_at = body.onboarding_complete ? now : null
      payload.current_step = body.onboarding_complete ? 6 : nextStep
    }

    if (body.calibration_answers && typeof body.calibration_answers === 'object') {
      payload.calibration_answers = body.calibration_answers
    }

    const { error } = await admin
      .from('onboarding_state')
      .upsert(payload, { onConflict: 'user_id' })

    if (error) {
      console.error('[onboarding/state] PATCH upsert', error)
      return NextResponse.json({ error: 'Could not save onboarding state' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[onboarding/state] PATCH', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
