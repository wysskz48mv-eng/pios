import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireWorkbenchUser } from '@/app/api/workbench/_auth'
import { getProfilePersonaModuleState } from '@/lib/profile-persona-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_MODULES = new Set(['CONSULTING_HUB', 'FM_CONSULTANT'])
const VALID_ENGAGEMENT_TYPES = new Set(['strategy', 'operations', 'change', 'commercial', 'diagnostic', 'other'])
const VALID_PHASES = new Set(['setup', 'execution', 'reporting', 'soft_landing', 'closeout'])

function isFmType(value: string) {
  return /^fm_type_[1-9]$/.test(value)
}

async function requireConsultingAccess(req: NextRequest) {
  const auth = await requireWorkbenchUser(req)
  if ('error' in auth) return { error: auth.error }

  const { user } = auth
  const state = await getProfilePersonaModuleState(user.id)
  const hasAccess = state.activeModules.some((moduleCode) => ALLOWED_MODULES.has(moduleCode))

  if (!hasAccess) {
    return {
      error: NextResponse.json(
        { error: 'Consulting Hub module is not active for this profile' },
        { status: 403 }
      ),
    }
  }

  return auth
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireConsultingAccess(req)
    if ('error' in auth) return auth.error

    const { user, admin } = auth
    const status = req.nextUrl.searchParams.get('status')
    const phase = req.nextUrl.searchParams.get('phase')
    const fmOnly = req.nextUrl.searchParams.get('fm_only') === 'true'

    let query = admin
      .from('consulting_engagements')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    } else {
      query = query.neq('status', 'archived')
    }

    if (phase) query = query.eq('current_phase', phase)
    if (fmOnly) query = query.not('fm_engagement_type_code', 'is', null)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ engagements: data ?? [] })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireConsultingAccess(req)
    if ('error' in auth) return auth.error

    const { user, admin } = auth
    const body = (await req.json()) as {
      client_name?: string
      title?: string
      engagement_type?: string
      fm_engagement_type_code?: string | null
      brief?: string
      status?: string
      project_id?: string | null
      start_date?: string | null
      end_date?: string | null
      value?: number | null
      currency?: string | null
      tags?: string[]
      current_step?: number
      current_phase?: string
      industry_sector?: string | null
      building_type?: string | null
      project_scale?: string | null
    }

    const clientName = String(body.client_name ?? '').trim()
    const title = String(body.title ?? '').trim()
    const engagementType = String(body.engagement_type ?? 'strategy').trim().toLowerCase()
    const fmTypeCode = body.fm_engagement_type_code ? String(body.fm_engagement_type_code).trim().toLowerCase() : null
    const step = body.current_step == null ? 1 : Number(body.current_step)
    const phase = String(body.current_phase ?? 'setup').toLowerCase()

    if (!clientName) {
      return NextResponse.json({ error: 'client_name is required' }, { status: 400 })
    }

    if (!VALID_ENGAGEMENT_TYPES.has(engagementType) && !isFmType(engagementType)) {
      return NextResponse.json({ error: 'Invalid engagement_type' }, { status: 400 })
    }

    if (fmTypeCode && !isFmType(fmTypeCode)) {
      return NextResponse.json({ error: 'fm_engagement_type_code must be fm_type_1..fm_type_9' }, { status: 400 })
    }

    if (!Number.isInteger(step) || step < 1 || step > 7) {
      return NextResponse.json({ error: 'current_step must be an integer between 1 and 7' }, { status: 400 })
    }

    if (!VALID_PHASES.has(phase)) {
      return NextResponse.json({ error: 'current_phase must be setup|execution|reporting|soft_landing|closeout' }, { status: 400 })
    }

    const insertPayload = {
      user_id: user.id,
      client_name: clientName,
      title: title || `${clientName} Engagement`,
      engagement_type: VALID_ENGAGEMENT_TYPES.has(engagementType) ? engagementType : 'strategy',
      fm_engagement_type_code: fmTypeCode,
      brief: body.brief ? String(body.brief) : null,
      status: body.status ? String(body.status) : 'active',
      project_id: body.project_id ?? null,
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
      value: body.value ?? null,
      currency: body.currency ?? 'GBP',
      tags: Array.isArray(body.tags) ? body.tags.map((tag) => String(tag)) : [],
      current_step: step,
      current_phase: phase,
      industry_sector: body.industry_sector ?? null,
      building_type: body.building_type ?? null,
      project_scale: body.project_scale ?? null,
    }

    const { data: engagement, error } = await admin
      .from('consulting_engagements')
      .insert(insertPayload)
      .select('*')
      .single()

    if (error) throw error

    const seedSteps = Array.from({ length: 7 }, (_, idx) => ({
      engagement_id: engagement.id,
      step_number: idx + 1,
      gate_status: idx === 0 ? 'passed' : 'pending',
      artefacts: {},
    }))

    await admin.from('engagement_steps').upsert(seedSteps, { onConflict: 'engagement_id,step_number' })

    return NextResponse.json({ engagement }, { status: 201 })
  } catch (err: unknown) {
    return apiError(err)
  }
}
