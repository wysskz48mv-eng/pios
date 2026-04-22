import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireOwnedEngagement, cleanStringArray } from '@/app/api/fm/_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string }

type OptionPayload = {
  option_id?: string
  option_number?: number
  title?: string
  description?: string
  pros?: string[]
  cons?: string[]
  estimated_cost_min?: number | null
  estimated_cost_max?: number | null
  implementation_time_weeks?: number | null
  risk_level?: 'low' | 'medium' | 'high'
  is_recommended?: boolean
  recommendation_reasoning?: string | null
}

export async function GET(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { id } = await context.params
    const auth = await requireOwnedEngagement(req, id)
    if ('error' in auth) return auth.error

    const { admin } = auth
    const { data, error } = await admin.from('fm_options').select('*').eq('engagement_id', id).order('option_number', { ascending: true })
    if (error) throw error

    return Response.json({ options: data ?? [] })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function POST(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { id } = await context.params
    const auth = await requireOwnedEngagement(req, id)
    if ('error' in auth) return auth.error

    const { admin, tenantId } = auth
    const body = (await req.json()) as OptionPayload

    const optionNumber = Number(body.option_number)
    if (!Number.isInteger(optionNumber) || optionNumber < 1 || optionNumber > 4) {
      return NextResponse.json({ error: 'option_number must be between 1 and 4' }, { status: 400 })
    }

    const title = String(body.title ?? '').trim()
    const description = String(body.description ?? '').trim()
    if (!title || !description) {
      return NextResponse.json({ error: 'title and description are required' }, { status: 400 })
    }

    const payload = {
      tenant_id: tenantId,
      engagement_id: id,
      option_number: optionNumber,
      title,
      description,
      pros: cleanStringArray(body.pros),
      cons: cleanStringArray(body.cons),
      estimated_cost_min: body.estimated_cost_min ?? null,
      estimated_cost_max: body.estimated_cost_max ?? null,
      implementation_time_weeks: body.implementation_time_weeks ?? null,
      risk_level: body.risk_level ?? 'medium',
      is_recommended: Boolean(body.is_recommended),
      recommendation_reasoning: body.recommendation_reasoning ?? null,
    }

    const { data, error } = await admin.from('fm_options').insert(payload).select('*').single()
    if (error) throw error

    return NextResponse.json({ option: data }, { status: 201 })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { id } = await context.params
    const auth = await requireOwnedEngagement(req, id)
    if ('error' in auth) return auth.error

    const { admin } = auth
    const body = (await req.json()) as OptionPayload
    const optionId = String(body.option_id ?? '').trim()
    if (!optionId) return NextResponse.json({ error: 'option_id is required' }, { status: 400 })

    const updates: Record<string, unknown> = {}
    if (body.title !== undefined) updates.title = String(body.title ?? '').trim()
    if (body.description !== undefined) updates.description = String(body.description ?? '').trim()
    if (body.pros !== undefined) updates.pros = cleanStringArray(body.pros)
    if (body.cons !== undefined) updates.cons = cleanStringArray(body.cons)
    if (body.estimated_cost_min !== undefined) updates.estimated_cost_min = body.estimated_cost_min
    if (body.estimated_cost_max !== undefined) updates.estimated_cost_max = body.estimated_cost_max
    if (body.implementation_time_weeks !== undefined) updates.implementation_time_weeks = body.implementation_time_weeks
    if (body.risk_level !== undefined) {
      const riskLevel = String(body.risk_level).toLowerCase()
      if (!['low', 'medium', 'high'].includes(riskLevel)) {
        return NextResponse.json({ error: 'risk_level must be low|medium|high' }, { status: 400 })
      }
      updates.risk_level = riskLevel
    }
    if (body.is_recommended !== undefined) updates.is_recommended = Boolean(body.is_recommended)
    if (body.recommendation_reasoning !== undefined) updates.recommendation_reasoning = body.recommendation_reasoning

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('fm_options')
      .update(updates)
      .eq('id', optionId)
      .eq('engagement_id', id)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Option not found' }, { status: 404 })

    return NextResponse.json({ option: data })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { id } = await context.params
    const auth = await requireOwnedEngagement(req, id)
    if ('error' in auth) return auth.error

    const { admin } = auth
    const body = (await req.json().catch(() => ({}))) as { option_id?: string }
    const optionId = String(body.option_id ?? req.nextUrl.searchParams.get('option_id') ?? '').trim()
    if (!optionId) return NextResponse.json({ error: 'option_id is required' }, { status: 400 })

    const { data: existing, error: readError } = await admin
      .from('fm_options')
      .select('id')
      .eq('id', optionId)
      .eq('engagement_id', id)
      .maybeSingle()
    if (readError) throw readError
    if (!existing) return NextResponse.json({ error: 'Option not found' }, { status: 404 })

    const { error } = await admin.from('fm_options').delete().eq('id', optionId).eq('engagement_id', id)
    if (error) throw error

    return NextResponse.json({ deleted: true, option_id: optionId })
  } catch (err: unknown) {
    return apiError(err)
  }
}
