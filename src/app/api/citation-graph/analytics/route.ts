import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function toMapCount(values: string[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const v of values) m[v] = (m[v] ?? 0) + 1
  return m
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as Record<string, unknown>
    const action = String(body.action ?? '')

    if (action === 'get_research_landscape') {
      const field = String(body.field ?? 'General')

      const { data: papers } = await supabase
        .from('pios_papers')
        .select('id,title,keywords,field_classifications,citation_count,influence_score,authors')

      const filtered = (papers ?? []).filter(p => ((p.field_classifications as string[] | null) ?? []).includes(field))
      const authorNames = filtered.flatMap(p => (p.authors as string[] | null) ?? [])
      const keywordNames = filtered.flatMap(p => (p.keywords as string[] | null) ?? [])

      const authorCounts = Object.entries(toMapCount(authorNames)).sort((a, b) => b[1] - a[1]).slice(0, 10)
      const keywordCounts = Object.entries(toMapCount(keywordNames)).sort((a, b) => b[1] - a[1]).slice(0, 10)

      const topResearchers = authorCounts.map(([name]) => name)
      const emergingKeywords = keywordCounts.map(([keyword, count]) => ({ keyword, count }))
      const foundational = [...filtered]
        .sort((a, b) => ((b.citation_count as number | null) ?? 0) - ((a.citation_count as number | null) ?? 0))
        .slice(0, 10)
        .map(p => p.id as string)

      return NextResponse.json({
        field,
        top_researchers: topResearchers,
        foundational_papers: foundational,
        emerging_keywords: emergingKeywords,
        total_papers: filtered.length,
        total_authors: new Set(authorNames).size,
        date_computed: new Date().toISOString(),
      })
    }

    if (action === 'get_author_influence') {
      const authorName = String(body.author_name ?? '').trim()
      if (!authorName) return NextResponse.json({ error: 'author_name required' }, { status: 400 })

      const normalized = authorName.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
      const { data: author } = await supabase
        .from('pios_authors')
        .select('*')
        .eq('normalized_name', normalized)
        .maybeSingle()

      if (!author?.id) return NextResponse.json({ error: 'Author not found' }, { status: 404 })

      const { data: links } = await supabase
        .from('pios_author_papers')
        .select('paper_id')
        .eq('author_id', author.id)

      const paperIds = (links ?? []).map(l => l.paper_id as string)
      const { data: papers } = paperIds.length === 0
        ? { data: [] as Record<string, unknown>[] }
        : await supabase
            .from('pios_papers')
            .select('id,title,publication_year,citation_count,influence_score,field_classifications,authors')
            .in('id', paperIds)

      const citations = (papers ?? []).reduce((s, p) => s + (((p.citation_count as number | null) ?? 0)), 0)
      const hIndex = Math.max(0, Math.floor(Math.sqrt(citations)))
      const collab = new Set((papers ?? []).flatMap(p => (p.authors as string[] | null) ?? []).map(a => a.toLowerCase()))
      collab.delete(normalized)

      const focus = Object.entries(toMapCount((papers ?? []).flatMap(p => ((p.field_classifications as string[] | null) ?? []))))
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'General'

      return NextResponse.json({
        author: {
          name: author.name,
          affiliation: author.affiliation,
          h_index: author.h_index ?? hIndex,
          total_citations: author.total_citations ?? citations,
          total_publications: (papers ?? []).length,
        },
        papers: papers ?? [],
        profile: {
          influence_rank: citations >= 1000 ? 'Top 5% in Field' : citations >= 300 ? 'Top 20% in Field' : 'Developing',
          research_focus: focus,
          collaboration_network_size: collab.size,
          career_stage: (papers ?? []).length > 50 ? 'Senior' : (papers ?? []).length > 15 ? 'Mid-career' : 'Early',
        },
      })
    }

    if (action === 'detect_emerging_trends') {
      const field = String(body.field ?? 'General')
      const yearsWindow = Math.max(2, Number(body.years ?? 5))
      const now = new Date().getFullYear()
      const minYear = now - yearsWindow + 1

      const { data: trendRows } = await supabase
        .from('pios_research_trends')
        .select('keyword,year,paper_count,field')
        .eq('field', field)
        .gte('year', minYear)

      const byKeyword = new Map<string, { first: number; last: number }>()
      for (const row of trendRows ?? []) {
        const kw = row.keyword as string
        if (kw === '__all__') continue
        const y = row.year as number
        const c = (row.paper_count as number | null) ?? 0
        const rec = byKeyword.get(kw) ?? { first: c, last: c }
        if (y === minYear) rec.first = c
        if (y === now) rec.last = c
        byKeyword.set(kw, rec)
      }

      const emerging: string[] = []
      const declining: string[] = []
      for (const [kw, s] of byKeyword.entries()) {
        const growth = s.first > 0 ? ((s.last - s.first) / s.first) * 100 : (s.last > 0 ? 100 : 0)
        if (growth >= 40) emerging.push(kw)
        if (growth <= -25) declining.push(kw)
      }

      const totals = (trendRows ?? []).filter(r => (r.keyword as string) === '__all__')
      const first = totals.find(r => (r.year as number) === minYear)
      const last = totals.find(r => (r.year as number) === now)
      const growthRate = ((last?.paper_count as number | undefined) && (first?.paper_count as number | undefined))
        ? (((last!.paper_count as number) - (first!.paper_count as number)) / Math.max(1, (first!.paper_count as number))) * 100
        : 0

      const totalPapers = totals.reduce((s, r) => s + ((r.paper_count as number | null) ?? 0), 0)

      return NextResponse.json({
        field,
        period: `Last ${yearsWindow} years`,
        emerging_topics: emerging.slice(0, 10),
        declining_topics: declining.slice(0, 10),
        growth_rate: Number(growthRate.toFixed(2)),
        total_papers: totalPapers,
      })
    }

    if (action === 'analyze_open_access') {
      const field = String(body.field ?? 'General')
      const yearFilter = Number(body.year ?? 0)

      const { data: papers } = await supabase
        .from('pios_papers')
        .select('open_access,publication_year,field_classifications')

      const filtered = (papers ?? []).filter(p => {
        const fields = (p.field_classifications as string[] | null) ?? []
        if (!fields.includes(field)) return false
        if (!yearFilter) return true
        return (p.publication_year as number | null) === yearFilter
      })

      const oaPapers = filtered.filter(p => Boolean(p.open_access)).length
      const total = filtered.length

      const byYear = new Map<number, { total: number; oa: number }>()
      for (const p of papers ?? []) {
        const y = (p.publication_year as number | null)
        if (!y) continue
        const fields = (p.field_classifications as string[] | null) ?? []
        if (!fields.includes(field)) continue
        const e = byYear.get(y) ?? { total: 0, oa: 0 }
        e.total += 1
        if (p.open_access) e.oa += 1
        byYear.set(y, e)
      }

      const trend = [...byYear.entries()].sort((a, b) => a[0] - b[0]).slice(-5).map(([year, s]) => ({
        year,
        oa_percentage: s.total > 0 ? Math.round((s.oa / s.total) * 100) : 0,
        total_papers: s.total,
        oa_papers: s.oa,
      }))

      return NextResponse.json({
        field,
        total_papers: total,
        oa_papers: oaPapers,
        oa_percentage: total > 0 ? Math.round((oaPapers / total) * 100) : 0,
        trend,
      })
    }

    if (action === 'get_database_stats') {
      const [papers, authors, citations, trends] = await Promise.all([
        supabase.from('pios_papers').select('id', { head: true, count: 'exact' }),
        supabase.from('pios_authors').select('id', { head: true, count: 'exact' }),
        supabase.from('pios_citations').select('id', { head: true, count: 'exact' }),
        supabase.from('pios_research_trends').select('field').limit(1000),
      ])

      const fields = [...new Set((trends.data ?? []).map(r => r.field as string).filter(Boolean))]

      return NextResponse.json({
        papers: papers.count ?? 0,
        authors: authors.count ?? 0,
        citations: citations.count ?? 0,
        fields,
        database_status: 'Building',
        last_updated: new Date().toISOString(),
      })
    }

    if (action === 'get_cron_status') {
      const { data: runs } = await supabase
        .from('pios_ingestion_events')
        .select('completed_at,status,papers_upserted,authors_upserted,links_upserted,notes')
        .eq('source', 'cron_citation_graph')
        .order('completed_at', { ascending: false })
        .limit(10)

      const items = (runs ?? []).map(r => ({
        completed_at: r.completed_at,
        status: r.status,
        papers_upserted: r.papers_upserted ?? 0,
        authors_upserted: r.authors_upserted ?? 0,
        links_upserted: r.links_upserted ?? 0,
        notes: r.notes,
      }))

      const lastRun = items[0] ?? null
      const successCount = items.filter(r => String(r.status) === 'success').length
      const failureCount = items.filter(r => String(r.status) !== 'success').length

      return NextResponse.json({
        configured: true,
        last_run: lastRun,
        recent_runs: items,
        success_count: successCount,
        failure_count: failureCount,
      })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal error' }, { status: 500 })
  }
}
