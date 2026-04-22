import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getPersonaPackaging, toCanonicalPersona } from '@/lib/persona-packaging'
import { getPersonaCalibrationConfig } from '@/lib/onboarding/persona-calibration'

export const dynamic = 'force-dynamic'

function maybeServiceClient() {
  try {
    return createServiceClient()
  } catch (error) {
    console.error('[onboarding/persona] service client unavailable, falling back to session client', error)
    return createClient()
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
    if (!persona) {
      return NextResponse.json({ error: 'Invalid persona' }, { status: 400 })
    }

    const packaging = getPersonaPackaging(persona)
    const now = new Date().toISOString()

    const profileWrite = await admin.from('user_profiles').update({
      persona_type: persona,
      active_modules: packaging.fallbackFrameworkCodes,
      onboarding_current_step: 3,
      updated_at: now,
    }).eq('id', user.id)

    if (profileWrite.error) {
      console.error('[onboarding/persona] user_profiles update (non-fatal)', {
        userId: user.id,
        code: profileWrite.error.code,
        message: profileWrite.error.message,
        details: profileWrite.error.details,
      })
    }

    const configWrite = await admin.from('exec_intelligence_config').upsert({
      user_id: user.id,
      persona: persona,
      tone: getPersonaCalibrationConfig(persona).communicationStyle,
      updated_at: now,
    }, { onConflict: 'user_id' })

    if (configWrite.error) {
      console.error('[onboarding/persona] exec_intelligence_config upsert (non-fatal)', {
        userId: user.id,
        code: configWrite.error.code,
        message: configWrite.error.message,
      })
    }

    const stateWrite = await admin.from('onboarding_state').upsert({
      user_id: user.id,
      persona_selected: persona,
      current_step: 3,
      updated_at: now,
      created_at: now,
      last_seen_at: now,
    }, { onConflict: 'user_id' })

    if (stateWrite.error) {
      console.error('[onboarding/persona] onboarding_state upsert (non-fatal)', {
        userId: user.id,
        code: stateWrite.error.code,
        message: stateWrite.error.message,
      })
    }

    return NextResponse.json({
      ok: true,
      persisted: !profileWrite.error || !stateWrite.error,
      persona,
      modules: packaging.fallbackFrameworkCodes,
      config: getPersonaCalibrationConfig(persona),
    })
  } catch (error) {
    console.error('[onboarding/persona] PATCH unexpected error (non-blocking response)', error)
    return NextResponse.json({
      ok: true,
      persisted: false,
      warning: 'persona_persistence_failed',
      config: getPersonaCalibrationConfig('EXECUTIVE'),
    })
  }
}
