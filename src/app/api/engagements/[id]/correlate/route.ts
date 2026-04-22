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
    .select('id,user_id,client_name,linked_email_ids,correlation_confidence,correlation_reasoning')
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

    const { user, admin, engagement } = auth
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? 10)

    const { data, error } = await admin.rpc('suggest_linked_emails', {
      p_user_id: user.id,
      p_client_name: engagement.client_name,
      p_limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 30)) : 10,
    })

    if (error) throw error

    return NextResponse.json({
      engagement,
      suggestions: data ?? [],
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

    const { user, admin } = auth
    const body = (await req.json().catch(() => ({}))) as { limit?: number }

    const { data, error } = await admin.rpc('correlate_engagement_emails', {
      p_engagement_id: id,
      p_user_id: user.id,
      p_limit: body.limit && Number.isFinite(body.limit) ? Math.max(1, Math.min(body.limit, 30)) : 5,
    })

    if (error) throw error

    const { data: engagement, error: fetchError } = await admin
      .from('consulting_engagements')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError) throw fetchError

    return NextResponse.json({ linked: data, engagement })
  } catch (err: unknown) {
    return apiError(err)
  }
}
