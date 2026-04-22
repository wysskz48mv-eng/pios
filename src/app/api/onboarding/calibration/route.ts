import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getPersonaCalibrationConfig } from '@/lib/onboarding/persona-calibration'
import { toCanonicalPersona } from '@/lib/persona-packaging'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const admin = createServiceClient()
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
    console.error('[onboarding/calibration] GET', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient()
    const admin = createServiceClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const persona = toCanonicalPersona(body.persona)
    const answers = (body.answers && typeof body.answers === 'object') ? body.answers as Record<string, unknown> : {}
    if (!persona) return NextResponse.json({ error: 'Invalid persona' }, { status: 400 })

    const now = new Date().toISOString()
    const config = getPersonaCalibrationConfig(persona)

    await admin.from('onboarding_state').upsert({
      user_id: user.id,
      persona_selected: persona,
      calibration_answers: answers,
      current_step: 4,
      updated_at: now,
      created_at: now,
      last_seen_at: now,
    }, { onConflict: 'user_id' })

    await admin.from('exec_intelligence_config').upsert({
      user_id: user.id,
      persona: persona,
      tone: config.communicationStyle,
      company_ctx: Object.entries(answers)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .slice(0, 8)
        .join(' | '),
      updated_at: now,
    }, { onConflict: 'user_id' })

    return NextResponse.json({ ok: true, communication_style: config.communicationStyle })
  } catch (error) {
    console.error('[onboarding/calibration] PATCH', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
