import { NextRequest } from 'next/server'
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

    const { admin } = auth
    const { data, error } = await admin
      .from('fm_options')
      .select('*')
      .eq('engagement_id', id)
      .order('option_number', { ascending: true })

    if (error) throw error

    return Response.json({ options: data ?? [] })
  } catch (err: unknown) {
    return apiError(err)
  }
}
