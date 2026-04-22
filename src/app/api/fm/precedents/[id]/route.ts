import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireFmAccess } from '@/app/api/fm/_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string }

export async function GET(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const auth = await requireFmAccess(req)
    if ('error' in auth) return auth.error

    const { id } = await context.params
    const { admin, user } = auth

    const { data, error } = await admin
      .from('fm_precedents')
      .select('*')
      .eq('id', id)
      .or(`user_id.eq.${user.id},is_public.eq.true`)
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Precedent not found' }, { status: 404 })

    return NextResponse.json({ precedent: data })
  } catch (err: unknown) {
    return apiError(err)
  }
}
