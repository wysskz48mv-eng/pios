import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getPersonaPackaging, toCanonicalPersona } from '@/lib/persona-packaging'
import { getPersonaCalibrationConfig } from '@/lib/onboarding/persona-calibration'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient()
    const admin = createServiceClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const persona = toCanonicalPersona(body.persona)
    if (!persona) {
      return NextResponse.json({ error: 'Invalid persona' }, { status: 400 })
    }

    const packaging = getPersonaPackaging(persona)
    const now = new Date().toISOString()

    await admin.from('user_profiles').update({
      persona_type: persona,
      active_modules: packaging.fallbackFrameworkCodes,
      onboarding_current_step: 3,
      updated_at: now,
    }).eq('id', user.id)

    await admin.from('exec_intelligence_config').upsert({
      user_id: user.id,
      persona: persona,
      tone: getPersonaCalibrationConfig(persona).communicationStyle,
      updated_at: now,
    }, { onConflict: 'user_id' })

    await admin.from('onboarding_state').upsert({
      user_id: user.id,
      persona_selected: persona,
      current_step: 3,
      updated_at: now,
      created_at: now,
      last_seen_at: now,
    }, { onConflict: 'user_id' })

    return NextResponse.json({
      ok: true,
      persona,
      modules: packaging.fallbackFrameworkCodes,
      config: getPersonaCalibrationConfig(persona),
    })
  } catch (error) {
    console.error('[onboarding/persona] PATCH', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
