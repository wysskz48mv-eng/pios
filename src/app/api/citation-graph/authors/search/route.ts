import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireCitationGraphAccess } from '@/app/api/citation-graph/_shared'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireCitationGraphAccess(req)
    if ('error' in auth) return auth.error

    const { admin } = auth

    const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
    const affiliation = req.nextUrl.searchParams.get('affiliation')?.trim()
    const hIndexMin = Number(req.nextUrl.searchParams.get('h_index_min') ?? 0) || undefined
    const limit = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 25), 100))

    let query = admin
      .from('pios_authors')
      .select('id,orcid,full_name,display_name,affiliation,affiliation_country,h_index,paper_count,citation_count,data_source')
      .order('citation_count', { ascending: false })
      .limit(limit)

    if (q) query = query.or(`full_name.ilike.%${q}%,display_name.ilike.%${q}%`)
    if (affiliation) query = query.ilike('affiliation', `%${affiliation}%`)
    if (hIndexMin) query = query.gte('h_index', hIndexMin)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ results: data ?? [] })
  } catch (err) {
    return apiError(err)
  }
}
