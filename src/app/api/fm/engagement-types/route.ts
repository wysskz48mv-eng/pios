import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireFmAccess } from '@/app/api/fm/_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireFmAccess(req)
    if ('error' in auth) return auth.error

    const { admin } = auth
    const waveParam = req.nextUrl.searchParams.get('wave')
    const includeInactive = req.nextUrl.searchParams.get('include_inactive') === 'true'

    let query = admin
      .from('fm_engagement_types')
      .select('*')
      .order('type_number', { ascending: true })

    if (waveParam) {
      const wave = Number(waveParam)
      if (!Number.isInteger(wave) || wave < 1 || wave > 3) {
        return NextResponse.json({ error: 'wave must be an integer between 1 and 3' }, { status: 400 })
      }
      query = query.eq('wave', wave)
    }

    if (!includeInactive) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ engagement_types: data ?? [] })
  } catch (err: unknown) {
    return apiError(err)
  }
}
