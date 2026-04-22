import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MODULE_CODES } from '@/types/persona-modules'
import { getProfilePersonaModuleState, setUserModules } from '@/lib/profile-persona-service'

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

    return NextResponse.json({
      ok: true,
      active_modules: state.activeModules,
      active_personas: state.activePersonas,
      modules: state.modules,
      available_modules: MODULE_CODES,
    })
  } catch (error) {
    console.error('[api/profile/modules][GET]', error)
    return NextResponse.json({ error: 'Failed to load module settings' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as { modules?: string[] }

    const result = await setUserModules({
      userId: user.id,
      modules: body.modules,
    })

    return NextResponse.json({
      ok: true,
      active_modules: result.modules,
      active_personas: result.personas,
      workload_tracking_enabled: result.workloadTrackingEnabled,
    })
  } catch (error) {
    console.error('[api/profile/modules][POST]', error)
    return NextResponse.json({ error: 'Failed to save modules' }, { status: 500 })
  }
}
