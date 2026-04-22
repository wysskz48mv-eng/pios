import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireOwnedEngagement, cleanStringArray } from '@/app/api/fm/_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string }

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
      new Set((risks ?? []).flatMap((risk) => (Array.isArray(risk.linked_email_ids) ? risk.linked_email_ids : [])))
    )

    let emailMap = new Map<string, { id: string; subject: string | null; received_at: string | null }>()
    if (emailIds.length > 0) {
      const { data: emails } = await admin
        .from('email_items')
        .select('id,subject,received_at')
        .in('id', emailIds)
      emailMap = new Map((emails ?? []).map((row) => [row.id, row]))
    }

    const enriched = (risks ?? []).map((risk) => ({
      ...risk,
      linked_emails: (risk.linked_email_ids ?? [])
        .map((emailId: string) => emailMap.get(emailId))
        .filter(Boolean),
      linked_email_count: (risk.linked_email_ids ?? []).length,
    }))

    return NextResponse.json({
      engagement,
      risks: enriched,
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function POST(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { id } = await context.params
    const auth = await requireOwnedEngagement(req, id)
    if ('error' in auth) return auth.error

    const { admin, user } = auth
    const body = (await req.json()) as {
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
      evidence_document_ids?: string[]
      notes?: string
    }

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
      user_id: user.id,
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
      evidence_document_ids: cleanStringArray(body.evidence_document_ids),
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
