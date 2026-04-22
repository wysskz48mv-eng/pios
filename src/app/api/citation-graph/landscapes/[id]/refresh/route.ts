import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireCitationGraphAccess } from '@/app/api/citation-graph/_shared'
import { ingestByTopic } from '@/lib/citation-graph/ingestion-service'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCitationGraphAccess(req)
    if ('error' in auth) return auth.error

    const { admin, user } = auth
    const { id } = await context.params

    const { data: landscape, error: landscapeError } = await admin
      .from('pios_research_landscapes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (landscapeError) throw landscapeError
    if (!landscape) return NextResponse.json({ error: 'Landscape not found' }, { status: 404 })

    const keywords = Array.isArray(landscape.topic_keywords) ? (landscape.topic_keywords as string[]) : []

    const aggregateSummary = {
      papers_added: 0,
      papers_updated: 0,
      citations_added: 0,
      authors_added: 0,
      author_links_added: 0,
    }

    for (const keyword of keywords.slice(0, 5)) {
      const summary = await ingestByTopic(admin, keyword, {
        limit: 20,
        sources: ['openalex', 'crossref'],
      })

      aggregateSummary.papers_added += summary.papers_added
      aggregateSummary.papers_updated += summary.papers_updated
      aggregateSummary.citations_added += summary.citations_added
      aggregateSummary.authors_added += summary.authors_added
      aggregateSummary.author_links_added += summary.author_links_added
    }

    const { data: matchingPapers, error: papersError } = await admin
      .from('pios_papers')
      .select('id,title,citation_count')
      .or(keywords.map((keyword) => `title.ilike.%${keyword}%`).join(','))
      .order('citation_count', { ascending: false })
      .limit(300)

    if (papersError) throw papersError

    const paperIds = (matchingPapers ?? []).map((paper) => String(paper.id))

    const { data: updatedLandscape, error: updateError } = await admin
      .from('pios_research_landscapes')
      .update({
        paper_ids: paperIds,
        topic_cluster: {
          keywords,
          total_papers: paperIds.length,
          refreshed_at: new Date().toISOString(),
        },
        last_refreshed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      landscape: updatedLandscape,
      summary: aggregateSummary,
    })
  } catch (err) {
    return apiError(err)
  }
}
