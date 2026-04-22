import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireOwnedEngagement } from '@/app/api/fm/_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string }

export async function POST(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { id } = await context.params
    const auth = await requireOwnedEngagement(req, id)
    if ('error' in auth) return auth.error

    const { admin, engagement } = auth

    const { data: result, error: fnError } = await admin.rpc('correlate_emails_to_engagement', {
      p_engagement_id: id,
    })

    if (fnError) throw fnError

    const { data: refreshed, error: engagementError } = await admin
      .from('consulting_engagements')
      .select('id,title,client_name,linked_email_ids,auto_correlation_enabled')
      .eq('id', id)
      .maybeSingle()

    if (engagementError) throw engagementError

    return NextResponse.json({
      correlated_count: Number(result ?? 0),
      engagement: refreshed ?? {
        id,
        title: engagement.title,
        client_name: engagement.client_name,
        linked_email_ids: engagement.linked_email_ids ?? [],
      },
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}
