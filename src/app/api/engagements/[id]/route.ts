import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireWorkbenchUser } from '@/app/api/workbench/_auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string }

async function requireOwnedEngagement(req: NextRequest, engagementId: string) {
  const auth = await requireWorkbenchUser(req)
  if ('error' in auth) return { error: auth.error }

  const { user, admin } = auth
  const { data: engagement, error } = await admin
    .from('consulting_engagements')
    .select('*')
    .eq('id', engagementId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error
  if (!engagement) {
    return { error: NextResponse.json({ error: 'Engagement not found' }, { status: 404 }) }
  }

  return { user, admin, engagement }
}

export async function GET(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { id } = await context.params
    const auth = await requireOwnedEngagement(req, id)
    if ('error' in auth) return auth.error

    const { admin, engagement } = auth

    const [{ data: steps }, { data: appliedFrameworks }, { data: deliverables }] = await Promise.all([
      admin.from('engagement_steps').select('*').eq('engagement_id', id).order('step_number', { ascending: true }),
      admin.from('engagement_frameworks').select('*').eq('engagement_id', id).order('created_at', { ascending: false }),
      admin.from('engagement_deliverables').select('*').eq('engagement_id', id).order('created_at', { ascending: false }),
    ])

    return NextResponse.json({
      engagement,
      steps: steps ?? [],
      frameworks: appliedFrameworks ?? [],
      deliverables: deliverables ?? [],
    })
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
    const body = (await req.json()) as Record<string, unknown>

    const updates: Record<string, unknown> = {}

    if (body.title !== undefined) {
      const title = String(body.title ?? '').trim()
      if (!title) return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
      updates.title = title
    }

    if (body.client_name !== undefined) {
      const clientName = String(body.client_name ?? '').trim()
      if (!clientName) return NextResponse.json({ error: 'client_name cannot be empty' }, { status: 400 })
      updates.client_name = clientName
    }

    if (body.status !== undefined) {
      const status = String(body.status)
      updates.status = status
      if (status === 'archived' && body.archived_at === undefined) {
        updates.archived_at = new Date().toISOString()
      }
      if (status !== 'archived' && body.archived_at === undefined) {
        updates.archived_at = null
      }
    }

    if (body.current_step !== undefined) {
      const step = Number(body.current_step)
      if (!Number.isInteger(step) || step < 1 || step > 7) {
        return NextResponse.json({ error: 'current_step must be an integer between 1 and 7' }, { status: 400 })
      }
      updates.current_step = step
    }

    if (body.brief !== undefined) updates.brief = body.brief == null ? null : String(body.brief)
    if (body.framework_used !== undefined) updates.framework_used = body.framework_used == null ? null : String(body.framework_used)
    if (body.project_id !== undefined) updates.project_id = body.project_id
    if (body.start_date !== undefined) updates.start_date = body.start_date
    if (body.end_date !== undefined) updates.end_date = body.end_date
    if (body.value !== undefined) updates.value = body.value
    if (body.currency !== undefined) updates.currency = body.currency
    if (body.tags !== undefined) {
      updates.tags = Array.isArray(body.tags) ? body.tags.map((tag) => String(tag)) : []
    }
    if (body.archived_at !== undefined) updates.archived_at = body.archived_at

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('consulting_engagements')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ engagement: data })
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

    const { data, error } = await admin
      .from('consulting_engagements')
      .update({ status: 'archived', archived_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ engagement: data, archived: true })
  } catch (err: unknown) {
    return apiError(err)
  }
}
