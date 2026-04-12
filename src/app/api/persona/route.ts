import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VALID_PERSONAS = new Set(['student', 'professional', 'executive', 'founder', 'consultant'])

type PersonaDefaults = {
  tone_preference: string
  response_style: string
  persona_context: string
  goals_context: string
  custom_instructions: string
}

const PERSONA_DEFAULTS: Record<string, PersonaDefaults> = {
  executive: {
    tone_preference: 'professional',
    response_style: 'structured',
    persona_context: 'Senior decision-maker responsible for strategy, governance, and cross-functional execution. Prioritises clarity, risk visibility, and operational momentum.',
    goals_context: 'Drive strategic outcomes, reduce execution drag, and maintain alignment across teams and stakeholders.',
    custom_instructions: 'Lead with key decisions and trade-offs.\nSurface risk early.\nRecommend clear next actions with ownership and timing.',
  },
  founder: {
    tone_preference: 'direct',
    response_style: 'concise',
    persona_context: 'Founder-operator balancing product, growth, delivery, and fundraising constraints. Needs practical synthesis over theory.',
    goals_context: 'Accelerate growth, tighten execution loops, and protect strategic focus while handling uncertainty.',
    custom_instructions: 'Prioritise leverage over volume.\nOffer options with downside and expected impact.\nKeep recommendations implementation-ready.',
  },
  consultant: {
    tone_preference: 'professional',
    response_style: 'structured',
    persona_context: 'Client-facing advisor running problem-structuring, analysis, and recommendation delivery across multiple engagements.',
    goals_context: 'Increase client impact, deliver high-quality outputs quickly, and maintain robust consulting process discipline.',
    custom_instructions: 'Use hypothesis-driven framing.\nApply MECE structure where possible.\nEnd with client-ready recommendations and next steps.',
  },
  professional: {
    tone_preference: 'professional',
    response_style: 'structured',
    persona_context: 'Experienced professional coordinating priorities across projects and stakeholders with emphasis on dependable execution.',
    goals_context: 'Improve focus, consistency, and decision quality while maintaining sustainable delivery cadence.',
    custom_instructions: 'Summarise context first.\nSeparate urgent from important.\nProvide an action list with dependencies and sequencing.',
  },
  student: {
    tone_preference: 'coaching',
    response_style: 'detailed',
    persona_context: 'Learner balancing coursework, research, and personal commitments. Benefits from guided planning and progressive milestones.',
    goals_context: 'Improve study effectiveness, complete milestones on time, and convert plans into consistent daily progress.',
    custom_instructions: 'Break complex work into milestone steps.\nExplain rationale briefly before recommendations.\nInclude realistic study cadence guidance.',
  },
}

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
      .select('persona_context,company_context,goals_context,tone_preference,response_style,custom_instructions')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      profile: profile ?? null,
      config: config ?? null,
      defaults: PERSONA_DEFAULTS,
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as Record<string, unknown>
    const action = String(body.action ?? '')
    if (action !== 'apply_defaults') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    const personaType = String(body.persona_type ?? '')
    if (!VALID_PERSONAS.has(personaType)) {
      return NextResponse.json({ error: 'Invalid persona_type' }, { status: 400 })
    }

    const defaults = PERSONA_DEFAULTS[personaType]

    const { data: baseProfile, error: baseProfileError } = await (supabase as any)
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (baseProfileError) throw baseProfileError

    const { error: profileError } = await (supabase as any)
      .from('user_profiles')
      .update({ persona_type: personaType, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (profileError) throw profileError

    const configPayload = {
      user_id: user.id,
      tenant_id: baseProfile?.tenant_id ?? user.id,
      persona_context: defaults.persona_context,
      company_context: normalizeOptionalText(body.company_context),
      goals_context: defaults.goals_context,
      tone_preference: defaults.tone_preference,
      response_style: defaults.response_style,
      custom_instructions: defaults.custom_instructions,
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

    return NextResponse.json({ ok: true, defaults })
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
      company_context: normalizeOptionalText(body.company_context),
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
