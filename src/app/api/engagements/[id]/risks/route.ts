import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireOwnedEngagement, cleanStringArray } from '@/app/api/fm/_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string }

type RiskPayload = {
  risk_id?: string
  risk_library_id?: string
  probability?: 'low' | 'medium' | 'high'
  impact?: 'low' | 'medium' | 'high'
  custom_title?: string
  custom_description?: string
  mitigation_plan?: string
  mitigation_status?: 'open' | 'mitigating' | 'mitigated' | 'accepted'
  owner_user_id?: string | null
  target_closure_date?: string | null
  linked_email_ids?: string[]
  notes?: string
}

async function getRisk(admin: any, engagementId: string, riskId: string) {
  const { data, error } = await admin
    .from('engagement_risks')
    .select('*, risk_library:fm_risk_library(*)')
    .eq('engagement_id', engagementId)
    .eq('id', riskId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function GET(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { id } = await context.params
    const auth = await requireOwnedEngagement(req, id)
    if ('error' in auth) return auth.error

    const { admin, engagement } = auth

    const { data: risks, error } = await admin
      .from('engagement_risks')
      .select('*, risk_library:fm_risk_library(*)')
      .eq('engagement_id', id)
      .order('risk_score', { ascending: false })

    if (error) throw error

    const emailIds = Array.from(
      new Set((risks ?? []).flatMap((risk: any) => (Array.isArray(risk.linked_email_ids) ? risk.linked_email_ids : [])))
    )

    let emailMap = new Map<string, { id: string; subject: string | null; received_at: string | null }>()
    if (emailIds.length > 0) {
      const { data: emails } = await admin.from('email_items').select('id,subject,received_at').in('id', emailIds)
      emailMap = new Map((emails ?? []).map((row: any) => [row.id, row]))
    }

    const enriched = (risks ?? []).map((risk: any) => ({
      ...risk,
      linked_emails: (risk.linked_email_ids ?? []).map((emailId: string) => emailMap.get(emailId)).filter(Boolean),
      linked_email_count: (risk.linked_email_ids ?? []).length,
    }))

    return NextResponse.json({ engagement, risks: enriched })
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
    const body = (await req.json()) as RiskPayload

    const probability = String(body.probability ?? '').toLowerCase()
    const impact = String(body.impact ?? '').toLowerCase()

    if (!['low', 'medium', 'high'].includes(probability) || !['low', 'medium', 'high'].includes(impact)) {
      return NextResponse.json({ error: 'probability and impact must be low|medium|high' }, { status: 400 })
    }

    if (!body.risk_library_id && !String(body.custom_title ?? '').trim()) {
      return NextResponse.json({ error: 'risk_library_id or custom_title is required' }, { status: 400 })
    }

    let libraryRisk: { title: string; description: string; recommended_mitigations: string[] } | null = null
    if (body.risk_library_id) {
      const { data, error } = await admin
        .from('fm_risk_library')
        .select('title,description,recommended_mitigations')
        .eq('id', body.risk_library_id)
        .maybeSingle()
      if (error) throw error
      libraryRisk = data
      if (!libraryRisk) return NextResponse.json({ error: 'Risk library item not found' }, { status: 404 })
    }

    const payload = {
      tenant_id: tenantId,
      engagement_id: id,
      risk_library_id: body.risk_library_id ?? null,
      custom_title: body.custom_title ? String(body.custom_title).trim() : libraryRisk?.title ?? null,
      custom_description: body.custom_description ? String(body.custom_description).trim() : libraryRisk?.description ?? null,
      probability,
      impact,
      mitigation_plan:
        body.mitigation_plan ??
        (libraryRisk?.recommended_mitigations?.length
          ? libraryRisk.recommended_mitigations.map((line) => `- ${line}`).join('\n')
          : null),
      mitigation_status: body.mitigation_status ?? 'open',
      owner_user_id: body.owner_user_id ?? null,
      target_closure_date: body.target_closure_date ?? null,
      linked_email_ids: cleanStringArray(body.linked_email_ids),
      notes: body.notes ? String(body.notes) : null,
    }

    const { data: risk, error } = await admin
      .from('engagement_risks')
      .insert(payload)
      .select('*, risk_library:fm_risk_library(*)')
      .single()

    if (error) throw error

    return NextResponse.json({ risk }, { status: 201 })
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
    const body = (await req.json()) as RiskPayload

    const riskId = String(body.risk_id ?? '').trim()
    if (!riskId) return NextResponse.json({ error: 'risk_id is required' }, { status: 400 })

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
      if (status === 'mitigated' && body.target_closure_date === undefined) {
        updates.actual_closure_date = new Date().toISOString().slice(0, 10)
      }
    }

    if (body.owner_user_id !== undefined) updates.owner_user_id = body.owner_user_id
    if (body.target_closure_date !== undefined) updates.target_closure_date = body.target_closure_date
    if (body.notes !== undefined) updates.notes = body.notes == null ? null : String(body.notes)
    if (body.custom_title !== undefined) updates.custom_title = body.custom_title == null ? null : String(body.custom_title)
    if (body.custom_description !== undefined) updates.custom_description = body.custom_description == null ? null : String(body.custom_description)
    if (body.linked_email_ids !== undefined) updates.linked_email_ids = cleanStringArray(body.linked_email_ids)

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const existing = await getRisk(admin, id, riskId)
    if (!existing) return NextResponse.json({ error: 'Risk not found' }, { status: 404 })

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
    const { id } = await context.params
    const auth = await requireOwnedEngagement(req, id)
    if ('error' in auth) return auth.error

    const { admin } = auth
    const body = (await req.json().catch(() => ({}))) as { risk_id?: string }
    const riskId = String(body.risk_id ?? req.nextUrl.searchParams.get('risk_id') ?? '').trim()

    if (!riskId) return NextResponse.json({ error: 'risk_id is required' }, { status: 400 })

    const existing = await getRisk(admin, id, riskId)
    if (!existing) return NextResponse.json({ error: 'Risk not found' }, { status: 404 })

    const { error } = await admin.from('engagement_risks').delete().eq('id', riskId).eq('engagement_id', id)
    if (error) throw error

    return NextResponse.json({ deleted: true, risk_id: riskId })
  } catch (err: unknown) {
    return apiError(err)
  }
}
