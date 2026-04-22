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

    const { data: author, error: authorError } = await admin
      .from('pios_authors')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (authorError) throw authorError
    if (!author) return NextResponse.json({ error: 'Author not found' }, { status: 404 })

    const [{ data: links, error: linksError }, { data: collaborations, error: collabError }] = await Promise.all([
      admin
        .from('pios_author_papers')
        .select('author_position, pios_papers(*)')
        .eq('author_id', id)
        .order('author_position', { ascending: true })
        .limit(100),
      admin
        .from('pios_author_collaborations')
        .select('*')
        .or(`author_a_id.eq.${id},author_b_id.eq.${id}`)
        .order('collaboration_count', { ascending: false })
        .limit(25),
    ])

    if (linksError) throw linksError
    if (collabError) throw collabError

    const papers = (links ?? []).map((item) => {
      const joined = Array.isArray(item.pios_papers)
        ? (item.pios_papers[0] as Record<string, unknown> | undefined)
        : (item.pios_papers as Record<string, unknown> | null)

      return {
        ...(joined ?? {}),
        author_position: item.author_position,
      }
    })

    const totalCitations = papers.reduce((acc, paper) => acc + Number((paper as Record<string, unknown>).citation_count ?? 0), 0)

    return NextResponse.json({
      author,
      papers,
      collaborators: collaborations ?? [],
      metrics: {
        paper_count: papers.length,
        citation_count: totalCitations,
        h_index: author.h_index ?? null,
      },
    })
  } catch (err) {
    return apiError(err)
  }
}
