import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireCitationGraphAccess, parseBoolean } from '@/app/api/citation-graph/_shared'
import { buildRelevanceScore } from '@/lib/citation-graph/ingestion-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireCitationGraphAccess(req)
    if ('error' in auth) return auth.error

    const { admin, user, tenantId } = auth
    const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
    if (!q) return NextResponse.json({ error: 'q is required' }, { status: 400 })

    const yearMin = Number(req.nextUrl.searchParams.get('year_min') ?? 0) || undefined
    const yearMax = Number(req.nextUrl.searchParams.get('year_max') ?? 0) || undefined
    const oaOnly = parseBoolean(req.nextUrl.searchParams.get('oa_only'))
    const source = req.nextUrl.searchParams.get('source')?.trim()
    const venueType = req.nextUrl.searchParams.get('venue_type')?.trim()
    const limit = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 25), 100))
    const offset = Math.max(0, Number(req.nextUrl.searchParams.get('offset') ?? 0))

    let query = admin
      .from('pios_papers')
      .select('id,doi,arxiv_id,pubmed_id,title,abstract,publication_date,publication_year,venue,venue_type,oa_status,oa_url,pdf_url,citation_count,reference_count,data_source,external_id')
      .or(`title.ilike.%${q}%,abstract.ilike.%${q}%,doi.ilike.%${q}%`)
      .order('citation_count', { ascending: false })
      .range(offset, offset + limit - 1)

    if (yearMin) query = query.gte('publication_year', yearMin)
    if (yearMax) query = query.lte('publication_year', yearMax)
    if (oaOnly) query = query.not('oa_status', 'eq', 'closed')
    if (source) query = query.eq('data_source', source)
    if (venueType) query = query.eq('venue_type', venueType)

    const { data: papers, error } = await query
    if (error) throw error

    const withScores = (papers ?? []).map((paper) => ({
      ...paper,
      relevance_score: buildRelevanceScore(q, {
        title: String(paper.title ?? ''),
        abstract: (paper.abstract as string | null) ?? null,
        citation_count: Number(paper.citation_count ?? 0),
        publication_year: Number(paper.publication_year ?? 0) || null,
      }),
    })).sort((a, b) => b.relevance_score - a.relevance_score)

    await admin.from('pios_user_searches').insert({
      tenant_id: tenantId,
      user_id: user.id,
      query: q,
      search_type: 'topic',
      filters: {
        year_min: yearMin,
        year_max: yearMax,
        oa_only: oaOnly,
        source,
        venue_type: venueType,
      },
      result_count: withScores.length,
      result_paper_ids: withScores.map((paper) => paper.id),
      data_source: source ?? 'multi',
    })

    return NextResponse.json({
      results: withScores,
      pagination: {
        limit,
        offset,
        returned: withScores.length,
      },
    })
  } catch (err) {
    return apiError(err)
  }
}
