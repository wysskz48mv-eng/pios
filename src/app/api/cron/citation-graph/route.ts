/**
 * GET /api/cron/citation-graph
 * Protected by CRON_SECRET.
 *
 * Daily pipeline:
 * 1) Ingest papers from Crossref + OpenAlex for bootstrap queries
 * 2) Recompute influence scores for ingested corpus
 * 3) Recompute trend rows for known fields
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCronSecret } from '@/lib/security/route-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const DEFAULT_QUERIES = [
  'AI forecasting facility management',
  'digital twins in facilities management',
  'predictive maintenance machine learning buildings',
  'lifecycle costing facilities management GCC',
  'smart building IoT maintenance analytics',
]

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
    const select = 'title,doi,publication_year,authorships,primary_location,cited_by_count'
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

export async function GET(req: NextRequest) {
  const authErr = requireCronSecret(req)
  if (authErr) return authErr

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const started = Date.now()
  const cronActorUserId = process.env.CITATION_GRAPH_CRON_ACTOR_USER_ID?.trim()

  const fromEnv = (process.env.CITATION_GRAPH_BOOTSTRAP_QUERIES ?? '')
    .split(',')
    .map(q => q.trim())
    .filter(Boolean)
  const queries = fromEnv.length > 0 ? fromEnv : DEFAULT_QUERIES
  const perSourceLimit = Math.min(50, Math.max(10, Number(process.env.CITATION_GRAPH_QUERY_LIMIT ?? 30)))

  let totalIngested = 0
  let totalAuthors = 0
  let totalLinks = 0

  try {
    for (const query of queries) {
      const [crossref, openalex] = await Promise.all([
        searchCrossref(query, perSourceLimit),
        searchOpenAlex(query, perSourceLimit),
      ])

      const seen = new Set<string>()
      const merged: PaperSeed[] = []
      for (const p of [...crossref, ...openalex]) {
        const key = p.doi ?? normTitle(p.title)
        if (seen.has(key)) continue
        seen.add(key)
        merged.push(p)
      }

      for (const p of merged) {
        const field = inferField(p.title, p.journal)
        const keywords = extractKeywords(p.title)

        const { data: paper } = await admin
          .from('pios_papers')
          .upsert({
            doi: p.doi,
            title: p.title,
            title_normalized: normTitle(p.title),
            authors: p.authors,
            publication_year: p.year,
            journal: p.journal,
            abstract_excerpt: p.abstract_excerpt,
            field_classifications: [field],
            keywords,
            open_access: false,
            citation_count: p.citation_count,
            sources: p.sources,
          }, { onConflict: 'title_normalized' })
          .select('id')
          .single()

        if (!paper?.id) continue
        totalIngested += 1

        for (let i = 0; i < p.authors.length; i += 1) {
          const name = p.authors[i]
          const normalized = normTitle(name)
          if (!normalized) continue

          const { data: author } = await admin
            .from('pios_authors')
            .upsert({ name, normalized_name: normalized }, { onConflict: 'normalized_name' })
            .select('id')
            .single()

          if (!author?.id) continue
          totalAuthors += 1

          await admin
            .from('pios_author_papers')
            .upsert({ author_id: author.id, paper_id: paper.id, author_position: i + 1 }, { onConflict: 'author_id,paper_id' })

          totalLinks += 1
        }
      }
    }

    // Recompute influence scores for all papers
    const { data: papers } = await admin
      .from('pios_papers')
      .select('id,publication_year,citation_count')
      .limit(50000)

    const nowYear = new Date().getFullYear()
    let scored = 0
    for (const p of papers ?? []) {
      const year = (p.publication_year as number | null) ?? nowYear
      const age = Math.max(0, nowYear - year)
      const recency = age <= 1 ? 1.5 : age <= 3 ? 1.35 : age <= 5 ? 1.15 : 1.0
      const citations = (p.citation_count as number | null) ?? 0
      const influence = Math.round(citations * recency * 1000) / 1000
      await admin.from('pios_papers').update({ influence_score: influence }).eq('id', p.id)
      scored += 1
    }

    // Refresh __all__ trend rows for standard fields
    const fields = ['Facility Management', 'AI & Forecasting', 'Engineering', 'Medicine', 'General']
    let trendRows = 0

    const { data: allPapers } = await admin
      .from('pios_papers')
      .select('publication_year,citation_count,field_classifications')

    for (const field of fields) {
      const filtered = (allPapers ?? []).filter(p => ((p.field_classifications as string[] | null) ?? []).includes(field))
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
      let prev = 0
      for (const y of years) {
        const s = byYear.get(y)!
        const growth = prev > 0 ? ((s.papers - prev) / prev) * 100 : 0
        prev = s.papers

        await admin.from('pios_research_trends').upsert({
          field,
          keyword: '__all__',
          year: y,
          paper_count: s.papers,
          citation_growth: Number(growth.toFixed(3)),
          emerging: growth >= 20,
        }, { onConflict: 'field,keyword,year' })

        trendRows += 1
      }
    }

    const elapsed = Math.round((Date.now() - started) / 1000)

    if (cronActorUserId) {
      await admin.from('pios_ingestion_events').insert({
        user_id: cronActorUserId,
        source: 'cron_citation_graph',
        papers_considered: queries.length * perSourceLimit * 2,
        papers_upserted: totalIngested,
        authors_upserted: totalAuthors,
        links_upserted: totalLinks,
        completed_at: new Date().toISOString(),
        status: 'success',
        notes: `queries=${queries.join(' | ')}`,
      }).then(() => null).catch(() => null)
    }

    return NextResponse.json({
      ok: true,
      queries,
      papers_ingested: totalIngested,
      authors_upserted: totalAuthors,
      links_upserted: totalLinks,
      papers_scored: scored,
      trend_rows_refreshed: trendRows,
      elapsed_s: elapsed,
      event_logging_enabled: Boolean(cronActorUserId),
    })
  } catch (error: unknown) {
    const elapsed = Math.round((Date.now() - started) / 1000)
    const message = error instanceof Error ? error.message : 'Citation graph cron failed'

    if (cronActorUserId) {
      await admin.from('pios_ingestion_events').insert({
        user_id: cronActorUserId,
        source: 'cron_citation_graph',
        papers_considered: queries.length * perSourceLimit * 2,
        papers_upserted: totalIngested,
        authors_upserted: totalAuthors,
        links_upserted: totalLinks,
        completed_at: new Date().toISOString(),
        status: 'failed',
        notes: `error=${message}; queries=${queries.join(' | ')}`,
      }).then(() => null).catch(() => null)
    }

    return NextResponse.json({
      ok: false,
      error: message,
      queries,
      papers_ingested: totalIngested,
      authors_upserted: totalAuthors,
      links_upserted: totalLinks,
      elapsed_s: elapsed,
      event_logging_enabled: Boolean(cronActorUserId),
    }, { status: 500 })
  }
}
