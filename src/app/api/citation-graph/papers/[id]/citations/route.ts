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

    const direction = req.nextUrl.searchParams.get('direction') ?? 'both'
    const depth = Math.min(2, Math.max(1, Number(req.nextUrl.searchParams.get('depth') ?? 1)))

    const nodes = new Map<string, { id: string; label: string; year: number | null; citation_count: number }>()
    const edges: Array<{ source: string; target: string; intent: string | null }> = []

    const { data: rootPaper, error: rootError } = await admin
      .from('pios_papers')
      .select('id,title,publication_year,citation_count')
      .eq('id', id)
      .maybeSingle()

    if (rootError) throw rootError
    if (!rootPaper) return NextResponse.json({ error: 'Paper not found' }, { status: 404 })

    nodes.set(String(rootPaper.id), {
      id: String(rootPaper.id),
      label: String(rootPaper.title ?? ''),
      year: Number(rootPaper.publication_year ?? 0) || null,
      citation_count: Number(rootPaper.citation_count ?? 0),
    })

    let frontier = [id]

    for (let d = 0; d < depth; d += 1) {
      if (frontier.length === 0) break

      let query = admin
        .from('pios_citations')
        .select('citing_paper_id,cited_paper_id,intent')
        .or(`citing_paper_id.in.(${frontier.join(',')}),cited_paper_id.in.(${frontier.join(',')})`)

      if (direction === 'citing') query = query.in('cited_paper_id', frontier)
      if (direction === 'cited') query = query.in('citing_paper_id', frontier)

      const { data: links, error: linksError } = await query.limit(250)
      if (linksError) throw linksError

      const nextFrontier = new Set<string>()
      const discovered = new Set<string>()

      for (const link of links ?? []) {
        const source = String(link.citing_paper_id)
        const target = String(link.cited_paper_id)
        edges.push({ source, target, intent: (link.intent as string | null) ?? null })
        discovered.add(source)
        discovered.add(target)
        if (!nodes.has(source)) nextFrontier.add(source)
        if (!nodes.has(target)) nextFrontier.add(target)
      }

      if (discovered.size > 0) {
        const { data: discoveredPapers, error: discoveredError } = await admin
          .from('pios_papers')
          .select('id,title,publication_year,citation_count')
          .in('id', [...discovered])
        if (discoveredError) throw discoveredError

        for (const paper of discoveredPapers ?? []) {
          nodes.set(String(paper.id), {
            id: String(paper.id),
            label: String(paper.title ?? ''),
            year: Number(paper.publication_year ?? 0) || null,
            citation_count: Number(paper.citation_count ?? 0),
          })
        }
      }

      frontier = [...nextFrontier]
    }

    return NextResponse.json({
      nodes: [...nodes.values()].map((node) => ({ ...node, type: 'paper' })),
      edges,
      meta: {
        depth,
        direction,
        node_count: nodes.size,
        edge_count: edges.length,
      },
    })
  } catch (err) {
    return apiError(err)
  }
}
