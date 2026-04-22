import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireOwnedEngagement, cleanStringArray } from '@/app/api/fm/_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string; riskId: string }

async function requireOwnedRisk(req: NextRequest, engagementId: string, riskId: string) {
  const auth = await requireOwnedEngagement(req, engagementId)
  if ('error' in auth) return { error: auth.error }

  const { admin } = auth
  const { data: risk, error } = await admin
    .from('engagement_risks')
    .select('*')
    .eq('id', riskId)
    .eq('engagement_id', engagementId)
    .maybeSingle()

  if (error) throw error
  if (!risk) return { error: NextResponse.json({ error: 'Risk not found' }, { status: 404 }) }

  return { ...auth, risk }
}

export async function PATCH(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { id, riskId } = await context.params
    const auth = await requireOwnedRisk(req, id, riskId)
    if ('error' in auth) return auth.error

    const { admin } = auth
    const body = (await req.json()) as Record<string, unknown>

    const updates: Record<string, unknown> = {}
    if (body.probability !== undefined) {
      const value = String(body.probability).toLowerCase()
      if (!['low', 'medium', 'high'].includes(value)) {
        return NextResponse.json({ error: 'probability must be low|medium|high' }, { status: 400 })
      }
      updates.probability = value
    }

    if (body.impact !== undefined) {
      const value = String(body.impact).toLowerCase()
      if (!['low', 'medium', 'high'].includes(value)) {
        return NextResponse.json({ error: 'impact must be low|medium|high' }, { status: 400 })
      }
      updates.impact = value
    }

    if (body.mitigation_plan !== undefined) updates.mitigation_plan = body.mitigation_plan == null ? null : String(body.mitigation_plan)
    if (body.mitigation_status !== undefined) {
      const status = String(body.mitigation_status)
      if (!['open', 'mitigating', 'mitigated', 'accepted'].includes(status)) {
        return NextResponse.json({ error: 'invalid mitigation_status' }, { status: 400 })
      }
      updates.mitigation_status = status
      if (status === 'mitigated' && body.actual_closure_date === undefined) {
        updates.actual_closure_date = new Date().toISOString().slice(0, 10)
      }
    }

    if (body.owner_user_id !== undefined) updates.owner_user_id = body.owner_user_id
    if (body.target_closure_date !== undefined) updates.target_closure_date = body.target_closure_date
    if (body.actual_closure_date !== undefined) updates.actual_closure_date = body.actual_closure_date
    if (body.notes !== undefined) updates.notes = body.notes == null ? null : String(body.notes)
    if (body.custom_title !== undefined) updates.custom_title = body.custom_title == null ? null : String(body.custom_title)
    if (body.custom_description !== undefined) updates.custom_description = body.custom_description == null ? null : String(body.custom_description)
    if (body.linked_email_ids !== undefined) updates.linked_email_ids = cleanStringArray(body.linked_email_ids)
    if (body.evidence_document_ids !== undefined) updates.evidence_document_ids = cleanStringArray(body.evidence_document_ids)

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('engagement_risks')
      .update(updates)
      .eq('id', riskId)
      .eq('engagement_id', id)
      .select('*, risk_library:fm_risk_library(*)')
      .single()

    if (error) throw error

    return NextResponse.json({ risk: data })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { id, riskId } = await context.params
    const auth = await requireOwnedRisk(req, id, riskId)
    if ('error' in auth) return auth.error

    const { admin } = auth
    const { error } = await admin
      .from('engagement_risks')
      .delete()
      .eq('id', riskId)
      .eq('engagement_id', id)

    if (error) throw error

    return NextResponse.json({ deleted: true })
  } catch (err: unknown) {
    return apiError(err)
  }
}
