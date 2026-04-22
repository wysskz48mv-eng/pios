import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireOwnedEngagement } from '@/app/api/fm/_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string }

export async function GET(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { id } = await context.params
    const auth = await requireOwnedEngagement(req, id)
    if ('error' in auth) return auth.error

    const { admin, engagement } = auth
    const linkedIds = Array.isArray(engagement.linked_email_ids) ? engagement.linked_email_ids : []

    if (!linkedIds.length) {
      return NextResponse.json({ emails: [], linked_email_ids: [], total: 0 })
    }

    const { data: emails, error } = await admin
      .from('email_items')
      .select('id,subject,sender_name,from_name,sender_email,from_address,received_at,body_preview')
      .in('id', linkedIds)
      .order('received_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      linked_email_ids: linkedIds,
      emails: emails ?? [],
      total: linkedIds.length,
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}
