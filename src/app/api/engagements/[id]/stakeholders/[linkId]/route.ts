import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireOwnedEngagement } from '@/app/api/fm/_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string; linkId: string }

async function requireLink(req: NextRequest, engagementId: string, linkId: string) {
  const auth = await requireOwnedEngagement(req, engagementId)
  if ('error' in auth) return { error: auth.error }

  const { admin } = auth
  const { data, error } = await admin
    .from('engagement_stakeholders')
    .select('*')
    .eq('id', linkId)
    .eq('engagement_id', engagementId)
    .maybeSingle()

  if (error) throw error
  if (!data) return { error: NextResponse.json({ error: 'Stakeholder link not found' }, { status: 404 }) }

  return { ...auth, link: data }
}

export async function PATCH(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { id, linkId } = await context.params
    const auth = await requireLink(req, id, linkId)
    if ('error' in auth) return auth.error

    const { admin } = auth
    const body = (await req.json()) as { engagement_role?: string }

    const role = String(body.engagement_role ?? '').trim()
    if (!role) return NextResponse.json({ error: 'engagement_role is required' }, { status: 400 })

    const { data, error } = await admin
      .from('engagement_stakeholders')
      .update({ engagement_role: role })
      .eq('id', linkId)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ stakeholder_link: data })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { id, linkId } = await context.params
    const auth = await requireLink(req, id, linkId)
    if ('error' in auth) return auth.error

    const { admin } = auth
    const { error } = await admin.from('engagement_stakeholders').delete().eq('id', linkId)
    if (error) throw error

    return NextResponse.json({ deleted: true })
  } catch (err: unknown) {
    return apiError(err)
  }
}
