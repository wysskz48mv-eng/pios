import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VALID_PERSONAS = new Set(['student', 'professional', 'executive', 'founder', 'consultant'])

function normalizeOptionalText(value: unknown, maxLen = 4000) {
  if (value == null) return null
  const text = String(value).trim()
  if (!text) return null
  return text.slice(0, maxLen)
}

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile, error: profileError } = await (supabase as any)
      .from('user_profiles')
      .select('id,tenant_id,full_name,job_title,organisation,persona_type')
      .eq('id', user.id)
      .single()

    if (profileError) throw profileError

    const { data: config } = await (supabase as any)
      .from('exec_intelligence_config')
      .select('persona_context,goals_context,tone_preference,response_style,custom_instructions')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      profile: profile ?? null,
      config: config ?? null,
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as Record<string, unknown>
    const personaType = body.persona_type == null ? undefined : String(body.persona_type)

    if (personaType && !VALID_PERSONAS.has(personaType)) {
      return NextResponse.json({ error: 'Invalid persona_type' }, { status: 400 })
    }

    const profileUpdates: Record<string, unknown> = {}
    if (personaType) profileUpdates.persona_type = personaType
    if (body.job_title !== undefined) profileUpdates.job_title = normalizeOptionalText(body.job_title, 200)
    if (body.organisation !== undefined) profileUpdates.organisation = normalizeOptionalText(body.organisation, 200)

    if (Object.keys(profileUpdates).length > 0) {
      const { error } = await (supabase as any)
        .from('user_profiles')
        .update({ ...profileUpdates, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (error) throw error
    }

    const { data: baseProfile, error: baseProfileError } = await (supabase as any)
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (baseProfileError) throw baseProfileError

    const configPayload = {
      user_id: user.id,
      tenant_id: baseProfile?.tenant_id ?? user.id,
      persona_context: normalizeOptionalText(body.persona_context),
      goals_context: normalizeOptionalText(body.goals_context),
      tone_preference: normalizeOptionalText(body.tone_preference, 80) ?? 'professional',
      response_style: normalizeOptionalText(body.response_style, 80) ?? 'structured',
      custom_instructions: normalizeOptionalText(body.custom_instructions),
      updated_at: new Date().toISOString(),
    }

    const existing = await (supabase as any)
      .from('exec_intelligence_config')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing?.data?.id) {
      const { error } = await (supabase as any)
        .from('exec_intelligence_config')
        .update(configPayload)
        .eq('user_id', user.id)
      if (error) throw error
    } else {
      const { error } = await (supabase as any)
        .from('exec_intelligence_config')
        .insert(configPayload)
      if (error) throw error
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return apiError(err)
  }
}
