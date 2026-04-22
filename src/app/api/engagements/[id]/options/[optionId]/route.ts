import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireOwnedEngagement, cleanStringArray } from '@/app/api/fm/_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string; optionId: string }

async function requireOwnedOption(req: NextRequest, engagementId: string, optionId: string) {
  const auth = await requireOwnedEngagement(req, engagementId)
  if ('error' in auth) return { error: auth.error }

  const { admin } = auth
  const { data: option, error } = await admin
    .from('fm_options')
    .select('*')
    .eq('id', optionId)
    .eq('engagement_id', engagementId)
    .maybeSingle()

  if (error) throw error
  if (!option) return { error: NextResponse.json({ error: 'Option not found' }, { status: 404 }) }

  return { ...auth, option }
}

export async function PATCH(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { id, optionId } = await context.params
    const auth = await requireOwnedOption(req, id, optionId)
    if ('error' in auth) return auth.error

    const { admin } = auth
    const body = (await req.json()) as Record<string, unknown>

    const updates: Record<string, unknown> = {}

    if (body.title !== undefined) updates.title = String(body.title ?? '').trim()
    if (body.description !== undefined) updates.description = String(body.description ?? '').trim()
    if (body.pros !== undefined) updates.pros = cleanStringArray(body.pros)
    if (body.cons !== undefined) updates.cons = cleanStringArray(body.cons)
    if (body.estimated_cost_min !== undefined) updates.estimated_cost_min = body.estimated_cost_min
    if (body.estimated_cost_max !== undefined) updates.estimated_cost_max = body.estimated_cost_max
    if (body.cost_currency !== undefined) updates.cost_currency = String(body.cost_currency ?? 'GBP')
    if (body.implementation_time_weeks !== undefined) updates.implementation_time_weeks = body.implementation_time_weeks
    if (body.risk_level !== undefined) {
      const riskLevel = String(body.risk_level).toLowerCase()
      if (!['low', 'medium', 'high'].includes(riskLevel)) {
        return NextResponse.json({ error: 'risk_level must be low|medium|high' }, { status: 400 })
      }
      updates.risk_level = riskLevel
    }

    if (body.recommendation_reasoning !== undefined) {
      updates.recommendation_reasoning = body.recommendation_reasoning == null ? null : String(body.recommendation_reasoning)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('fm_options')
      .update(updates)
      .eq('id', optionId)
      .eq('engagement_id', id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ option: data })
  } catch (err: unknown) {
    return apiError(err)
  }
}
