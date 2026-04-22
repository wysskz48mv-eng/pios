import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireCitationGraphAccess } from '@/app/api/citation-graph/_shared'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireCitationGraphAccess(req)
    if ('error' in auth) return auth.error

    const { admin } = auth
    const topic = req.nextUrl.searchParams.get('topic')?.trim() ?? 'General Research'
    const yearStart = Number(req.nextUrl.searchParams.get('year_start') ?? 2018) || 2018
    const yearEnd = Number(req.nextUrl.searchParams.get('year_end') ?? new Date().getFullYear()) || new Date().getFullYear()

    const { data, error } = await admin
      .from('pios_research_trends')
      .select('topic,year,paper_count,citation_count,growth_rate,top_venues,top_authors,computed_at')
      .eq('topic', topic)
      .gte('year', yearStart)
      .lte('year', yearEnd)
      .order('year', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      topic,
      year_start: yearStart,
      year_end: yearEnd,
      series: data ?? [],
    })
  } catch (err) {
    return apiError(err)
  }
}
