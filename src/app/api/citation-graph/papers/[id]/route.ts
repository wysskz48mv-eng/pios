import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireCitationGraphAccess } from '@/app/api/citation-graph/_shared'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCitationGraphAccess(req)
    if ('error' in auth) return auth.error

    const { admin } = auth
    const { id } = await context.params

    const { data: paper, error: paperError } = await admin
      .from('pios_papers')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (paperError) throw paperError
    if (!paper) return NextResponse.json({ error: 'Paper not found' }, { status: 404 })

    const [{ data: authorLinks, error: authorError }, { data: citedBy, error: citedByError }, { data: references, error: refsError }] = await Promise.all([
      admin
        .from('pios_author_papers')
        .select('author_position, is_corresponding, pios_authors(*)')
        .eq('paper_id', id)
        .order('author_position', { ascending: true }),
      admin
        .from('pios_citations')
        .select('intent, context_snippet, pios_papers!pios_citations_citing_paper_id_fkey(id,title,publication_year,citation_count)')
        .eq('cited_paper_id', id)
        .limit(50),
      admin
        .from('pios_citations')
        .select('intent, context_snippet, pios_papers!pios_citations_cited_paper_id_fkey(id,title,publication_year,citation_count)')
        .eq('citing_paper_id', id)
        .limit(50),
    ])

    if (authorError) throw authorError
    if (citedByError) throw citedByError
    if (refsError) throw refsError

    return NextResponse.json({
      paper,
      authors: (authorLinks ?? []).map((link) => {
        const joined = Array.isArray(link.pios_authors)
          ? (link.pios_authors[0] as Record<string, unknown> | undefined)
          : (link.pios_authors as Record<string, unknown> | null)

        return {
          ...(joined ?? {}),
          author_position: link.author_position,
          is_corresponding: link.is_corresponding,
        }
      }),
      citations: {
        citing: citedBy ?? [],
        cited: references ?? [],
      },
      metrics: {
        citation_count: paper.citation_count ?? 0,
        reference_count: paper.reference_count ?? 0,
      },
    })
  } catch (err) {
    return apiError(err)
  }
}
