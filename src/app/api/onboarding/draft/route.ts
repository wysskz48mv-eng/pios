import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PERSONAS = new Set([
  'starter', 'pro', 'executive', 'enterprise',
  'CEO', 'CONSULTANT', 'ACADEMIC', 'CHIEF_OF_STAFF', 'EXECUTIVE', 'WHOLE_LIFE',
])
const DEPLOY_MODES = new Set(['full', 'hybrid', 'standalone'])

function normaliseDraft(body: Record<string, unknown>) {
  const step = typeof body.step === 'number' ? Math.min(Math.max(body.step, 0), 3) : 0
  const persona = typeof body.persona === 'string' && PERSONAS.has(body.persona) ? body.persona : null
  const goals = typeof body.goals === 'string' ? body.goals.slice(0, 8000) : ''
  const activeModules = Array.isArray(body.active_modules)
    ? body.active_modules.filter((item): item is string => typeof item === 'string').slice(0, 32)
    : []
  const deployMode = typeof body.deploy_mode === 'string' && DEPLOY_MODES.has(body.deploy_mode)
    ? body.deploy_mode
    : 'full'

  return {
    step,
    persona,
    goals,
    active_modules: activeModules,
    deploy_mode: deployMode,
    email_triage_consent: body.email_triage_consent !== false,
    google_connected: body.google_connected === true,
    microsoft_connected: body.microsoft_connected === true,
  }
}

export async function GET() {
  try {
    const supabase = createClient()
    const admin = createServiceClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: draft, error } = await admin
      .from('onboarding_drafts')
      .select('step, persona, goals, active_modules, deploy_mode, email_triage_consent, google_connected, microsoft_connected, updated_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('[onboarding/draft] load error:', error)
      return NextResponse.json({ error: 'Could not load draft' }, { status: 500 })
    }

    return NextResponse.json({ draft: draft ?? null })
  } catch (error) {
    console.error('[onboarding/draft] unhandled:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const admin = createServiceClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = normaliseDraft(await req.json())
    const now = new Date().toISOString()

    const { error } = await admin
      .from('onboarding_drafts')
      .upsert({
        user_id: user.id,
        ...payload,
        updated_at: now,
        created_at: now,
      }, { onConflict: 'user_id' })

    if (error) {
      console.error('[onboarding/draft] save error:', error)
      return NextResponse.json({ error: 'Could not save draft' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[onboarding/draft] unhandled:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = createClient()
    const admin = createServiceClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await admin
      .from('onboarding_drafts')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('[onboarding/draft] delete error:', error)
      return NextResponse.json({ error: 'Could not clear draft' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[onboarding/draft] unhandled:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
