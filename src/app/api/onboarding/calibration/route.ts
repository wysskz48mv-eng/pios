import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getPersonaCalibrationConfig } from '@/lib/onboarding/persona-calibration'
import { toCanonicalPersona } from '@/lib/persona-packaging'

export const dynamic = 'force-dynamic'

function maybeServiceClient() {
  try {
    return createServiceClient()
  } catch (error) {
    console.error('[onboarding/calibration] service client unavailable, falling back to session client', error)
    return createClient()
  }
}

export async function GET() {
  try {
    const supabase = createClient()
    const admin = maybeServiceClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: profile }, { data: state }] = await Promise.all([
      admin.from('user_profiles').select('persona_type').eq('id', user.id).maybeSingle(),
      admin.from('onboarding_state').select('calibration_answers,persona_selected').eq('user_id', user.id).maybeSingle(),
    ])

    const persona = toCanonicalPersona(state?.persona_selected ?? profile?.persona_type) ?? 'EXECUTIVE'
    const config = getPersonaCalibrationConfig(persona)

    return NextResponse.json({
      ok: true,
      persona,
      questions: config.questions,
      communication_style: config.communicationStyle,
      answers: state?.calibration_answers ?? {},
    })
  } catch (error) {
    console.error('[onboarding/calibration] GET fallback', error)
    const fallback = getPersonaCalibrationConfig('EXECUTIVE')
    return NextResponse.json({
      ok: true,
      warning: 'calibration_state_unavailable',
      persona: 'EXECUTIVE',
      questions: fallback.questions,
      communication_style: fallback.communicationStyle,
      answers: {},
    })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient()
    const admin = maybeServiceClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const persona = toCanonicalPersona(body.persona)
    const answers = (body.answers && typeof body.answers === 'object') ? body.answers as Record<string, unknown> : {}
    if (!persona) return NextResponse.json({ error: 'Invalid persona' }, { status: 400 })

    const now = new Date().toISOString()
    const config = getPersonaCalibrationConfig(persona)

    const stateWrite = await admin.from('onboarding_state').upsert({
      user_id: user.id,
      persona_selected: persona,
      calibration_answers: answers,
      current_step: 4,
      updated_at: now,
      created_at: now,
      last_seen_at: now,
    }, { onConflict: 'user_id' })

    if (stateWrite.error) {
      console.error('[onboarding/calibration] onboarding_state upsert (non-fatal)', {
        userId: user.id,
        code: stateWrite.error.code,
        message: stateWrite.error.message,
        details: stateWrite.error.details,
      })
    }

    const configWrite = await admin.from('exec_intelligence_config').upsert({
      user_id: user.id,
      persona: persona,
      tone: config.communicationStyle,
      company_ctx: Object.entries(answers)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .slice(0, 8)
        .join(' | '),
      updated_at: now,
    }, { onConflict: 'user_id' })

    if (configWrite.error) {
      console.error('[onboarding/calibration] exec_intelligence_config upsert (non-fatal)', {
        userId: user.id,
        code: configWrite.error.code,
        message: configWrite.error.message,
      })
    }

    return NextResponse.json({
      ok: true,
      persisted: !stateWrite.error || !configWrite.error,
      communication_style: config.communicationStyle,
    })
  } catch (error) {
    console.error('[onboarding/calibration] PATCH unexpected error (non-blocking response)', error)
    return NextResponse.json({ ok: true, persisted: false, warning: 'calibration_persistence_failed' })
  }
}
