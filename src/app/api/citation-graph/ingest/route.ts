import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type PaperSeed = {
  title: string
  doi: string | null
  year: number | null
  journal: string | null
  abstract_excerpt: string | null
  authors: string[]
  citation_count: number
  sources: string[]
}

function normTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function inferField(title: string, journal: string | null): string {
  const text = `${title} ${journal ?? ''}`.toLowerCase()
  if (text.includes('facility') || text.includes('maintenance')) return 'Facility Management'
  if (text.includes('forecast') || text.includes('machine learning') || text.includes('artificial intelligence')) return 'AI & Forecasting'
  if (text.includes('engineering')) return 'Engineering'
  if (text.includes('medical') || text.includes('biomed')) return 'Medicine'
  return 'General'
}

function extractKeywords(title: string): string[] {
  return [...new Set(normTitle(title).split(' ').filter(w => w.length >= 4))].slice(0, 10)
}

async function searchCrossref(query: string, limit: number): Promise<PaperSeed[]> {
  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}&mailto=support@veritasiq.io`
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!r.ok) return []
    const data = await r.json() as { message?: { items?: Record<string, unknown>[] } }
    return (data.message?.items ?? []).map(item => {
      const title = ((item.title as string[]) ?? [])[0] ?? ''
      const pub = ((item['published-print'] ?? item['published-online']) as { 'date-parts'?: number[][] } | null)
      const year = pub?.['date-parts']?.[0]?.[0] ?? null
      const authors = ((item.author as { given?: string; family?: string }[]) ?? [])
        .map(a => [a.given, a.family].filter(Boolean).join(' '))
        .filter(Boolean)
      return {
        title,
        doi: (item.DOI as string) ?? null,
        year,
        journal: ((item['container-title'] as string[]) ?? [])[0] ?? null,
        abstract_excerpt: ((item.abstract as string) ?? null)?.slice(0, 1200) ?? null,
        authors,
        citation_count: (item['is-referenced-by-count'] as number) ?? 0,
        sources: ['crossref'],
      }
    }).filter(p => p.title)
  } catch { return [] }
}

async function searchOpenAlex(query: string, limit: number): Promise<PaperSeed[]> {
  try {
    const select = 'title,doi,publication_year,authorships,primary_location,cited_by_count,abstract_inverted_index'
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}&select=${select}&mailto=support@veritasiq.io`
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!r.ok) return []
    const data = await r.json() as { results?: Record<string, unknown>[] }
    return (data.results ?? []).map(item => {
      const title = (item.title as string) ?? ''
      const authors = ((item.authorships as { author?: { display_name?: string } }[]) ?? [])
        .map(a => a.author?.display_name ?? '')
        .filter(Boolean)
      const loc = (item.primary_location as { source?: { display_name?: string } } | null)
      return {
        title,
        doi: (item.doi as string) ?? null,
        year: (item.publication_year as number) ?? null,
        journal: loc?.source?.display_name ?? null,
        abstract_excerpt: null,
        authors,
        citation_count: (item.cited_by_count as number) ?? 0,
        sources: ['openalex'],
      }
    }).filter(p => p.title)
  } catch { return [] }
}

async function upsertPaperGraph(seed: PaperSeed, supabase: Awaited<ReturnType<typeof createClient>>) {
  const field = inferField(seed.title, seed.journal)
  const keywords = extractKeywords(seed.title)

  const { data: paper, error } = await supabase
    .from('pios_papers')
    .upsert({
      doi: seed.doi,
      title: seed.title,
      title_normalized: normTitle(seed.title),
      authors: seed.authors,
      publication_year: seed.year,
      journal: seed.journal,
      abstract_excerpt: seed.abstract_excerpt,
      field_classifications: [field],
      keywords,
      open_access: false,
      citation_count: seed.citation_count,
      sources: seed.sources,
    }, { onConflict: 'title_normalized' })
    .select('id')
    .single()

  if (error || !paper?.id) return { paperId: null, authors: 0, links: 0, field }

  let authorsUpserted = 0
  let linksUpserted = 0

  for (let i = 0; i < seed.authors.length; i += 1) {
    const name = seed.authors[i]
    const normalized = normTitle(name)
    if (!normalized) continue

    const { data: author } = await supabase
      .from('pios_authors')
      .upsert({ name, normalized_name: normalized }, { onConflict: 'normalized_name' })
      .select('id')
      .single()

    if (!author?.id) continue
    authorsUpserted += 1

    await supabase
      .from('pios_author_papers')
      .upsert({ author_id: author.id, paper_id: paper.id, author_position: i + 1 }, { onConflict: 'author_id,paper_id' })

    linksUpserted += 1
  }

  return { paperId: paper.id as string, authors: authorsUpserted, links: linksUpserted, field }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as Record<string, unknown>
    const action = String(body.action ?? '')

    if (action === 'ingest_search_query') {
      const query = String(body.query ?? '').trim()
      const limit = Math.min(200, Math.max(10, Number(body.limit ?? 100)))
      if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

      const half = Math.max(10, Math.floor(limit / 2))
      const [crossref, openalex] = await Promise.all([
        searchCrossref(query, half),
        searchOpenAlex(query, half),
      ])

      const seen = new Set<string>()
      const merged: PaperSeed[] = []
      for (const p of [...crossref, ...openalex]) {
        const key = p.doi ?? normTitle(p.title)
        if (seen.has(key)) continue
        seen.add(key)
        merged.push(p)
      }

      let papersIngested = 0
      let authorsFound = 0
      let links = 0

      for (const paper of merged) {
        const result = await upsertPaperGraph(paper, supabase)
        if (result.paperId) papersIngested += 1
        authorsFound += result.authors
        links += result.links
      }

      await supabase.from('pios_ingestion_events').insert({
        user_id: user.id,
        source: 'citation_graph_query',
        papers_considered: merged.length,
        papers_upserted: papersIngested,
        authors_upserted: authorsFound,
        links_upserted: links,
        completed_at: new Date().toISOString(),
        status: 'success',
        notes: `query=${query}`,
      })

      return NextResponse.json({
        papers_ingested: papersIngested,
        sources: ['crossref', 'openalex'],
        authors_found: authorsFound,
        sample_papers: merged.slice(0, 5).map(p => ({ title: p.title, authors: p.authors.slice(0, 3), citation_count: p.citation_count })),
      })
    }

    if (action === 'compute_influence_scores') {
      const { data: papers } = await supabase
        .from('pios_papers')
        .select('id,publication_year,citation_count')
        .limit(25000)

      const nowYear = new Date().getFullYear()
      let scored = 0
      let sum = 0

      for (const p of papers ?? []) {
        const year = (p.publication_year as number | null) ?? nowYear
        const age = Math.max(0, nowYear - year)
        const recency = age <= 1 ? 1.5 : age <= 3 ? 1.35 : age <= 5 ? 1.15 : 1.0
        const citations = (p.citation_count as number | null) ?? 0
        const influence = Math.round(citations * recency * 1000) / 1000

        await supabase.from('pios_papers').update({ influence_score: influence }).eq('id', p.id)
        sum += influence
        scored += 1
      }

      return NextResponse.json({ papers_scored: scored, avg_influence: scored > 0 ? Number((sum / scored).toFixed(3)) : 0 })
    }

    if (action === 'compute_research_trends') {
      const field = String(body.field ?? 'General')
      const { data: papers } = await supabase
        .from('pios_papers')
        .select('publication_year,citation_count,field_classifications')

      const filtered = (papers ?? []).filter(p => {
        const fields = (p.field_classifications as string[] | null) ?? []
        return fields.includes(field)
      })

      const byYear = new Map<number, { papers: number; citations: number }>()
      for (const p of filtered) {
        const year = (p.publication_year as number | null)
        if (!year) continue
        const e = byYear.get(year) ?? { papers: 0, citations: 0 }
        e.papers += 1
        e.citations += (p.citation_count as number | null) ?? 0
        byYear.set(year, e)
      }

      const years = [...byYear.keys()].sort((a, b) => a - b)
      const output: Array<Record<string, unknown>> = []
      let prevPapers = 0
      for (const year of years) {
        const stats = byYear.get(year)!
        const growth = prevPapers > 0 ? ((stats.papers - prevPapers) / prevPapers) * 100 : 0
        prevPapers = stats.papers
        const row = {
          field,
          keyword: '__all__',
          year,
          paper_count: stats.papers,
          citation_growth: Number(growth.toFixed(3)),
          emerging: growth >= 20,
        }
        output.push({
          year,
          paper_count: stats.papers,
          citation_count: stats.citations,
          citation_growth_rate: Number(growth.toFixed(3)),
          emerging: growth >= 20,
          research_velocity: stats.papers,
          influence_index: Number((stats.citations / Math.max(stats.papers, 1)).toFixed(2)),
        })
        await supabase.from('pios_research_trends').upsert(row, { onConflict: 'field,keyword,year' })
      }

      return NextResponse.json({ field, trends_computed: output.length, trends: output })
    }

    if (action === 'search_citation_graph') {
      const query = String(body.query ?? '').trim()
      const limit = Math.min(100, Math.max(1, Number(body.limit ?? 50)))
      if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

      const { data: rows } = await supabase
        .from('pios_papers')
        .select('id,title,authors,publication_year,citation_count,influence_score')
        .ilike('title', `%${query}%`)
        .order('influence_score', { ascending: false })
        .limit(limit)

      const { count } = await supabase.from('pios_papers').select('id', { head: true, count: 'exact' })

      return NextResponse.json({
        results: rows ?? [],
        count: (rows ?? []).length,
        database_size: `${count ?? 0} papers`,
      })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal error' }, { status: 500 })
  }
}
