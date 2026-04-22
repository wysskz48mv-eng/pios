import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireFmAccess } from '@/app/api/fm/_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { typeCode: string }

export async function GET(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const auth = await requireFmAccess(req)
    if ('error' in auth) return auth.error

    const { typeCode } = await context.params
    const { admin } = auth

    const { data, error } = await admin
      .from('fm_engagement_types')
      .select('*')
      .eq('type_code', typeCode)
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'FM engagement type not found' }, { status: 404 })

    return NextResponse.json({ engagement_type: data })
  } catch (err: unknown) {
    return apiError(err)
  }
}
