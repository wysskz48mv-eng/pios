import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  PERSONA_DESCRIPTIONS,
  PERSONA_LABELS,
  normalisePersonaCodes,
  resolveModulesForPersonas,
} from '@/lib/persona-modules'
import {
  getProfilePersonaModuleState,
  setUserPersonasAndModules,
} from '@/lib/profile-persona-service'
import { PERSONA_CODES } from '@/types/persona-modules'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const state = await getProfilePersonaModuleState(user.id)

    const availablePersonas = PERSONA_CODES.map((code) => ({
      code,
      label: PERSONA_LABELS[code],
      description: PERSONA_DESCRIPTIONS[code],
      modules_if_selected: resolveModulesForPersonas([code]),
    }))

    return NextResponse.json({
      ok: true,
      active_personas: state.activePersonas,
      active_modules: state.activeModules,
      workload_tracking_enabled: state.workloadTrackingEnabled,
      personas: state.personas,
      available_personas: availablePersonas,
    })
  } catch (error) {
    console.error('[api/profile/personas][GET]', error)
    return NextResponse.json({ error: 'Failed to load persona settings' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as {
      personas?: string[]
      primary_persona?: string
      fm_consultant?: boolean
      riba_enabled?: boolean
    }

    const personas = normalisePersonaCodes(body.personas)
    if (!personas.length) {
      return NextResponse.json({ error: 'At least one persona is required' }, { status: 400 })
    }

    const result = await setUserPersonasAndModules({
      userId: user.id,
      personas,
      primaryPersona: body.primary_persona ?? personas[0],
      fmConsultant: Boolean(body.fm_consultant),
      ribaEnabled: Boolean(body.riba_enabled),
    })

    return NextResponse.json({
      ok: true,
      active_personas: result.personas,
      active_modules: result.modules,
      notes: {
        framework_mode: 'neutral_default',
        fm_specific_frameworks: Boolean(body.fm_consultant),
      },
    })
  } catch (error) {
    console.error('[api/profile/personas][POST]', error)
    return NextResponse.json({ error: 'Failed to save personas' }, { status: 500 })
  }
}
