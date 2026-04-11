import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type LitRow = {
  id: string
  doi: string | null
  title: string
  authors: string[] | null
  year: number | null
  journal: string | null
  abstract: string | null
  citation_count: number | null
  source_api: string | null
  pdf_url: string | null
  unpaywall_oa_url: string | null
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function inferKeywords(title: string): string[] {
  const words = normalizeTitle(title).split(' ').filter(w => w.length > 3)
  return [...new Set(words)].slice(0, 8)
}

function inferField(journal: string | null, title: string): string {
  const text = `${journal ?? ''} ${title}`.toLowerCase()
  if (text.includes('facility') || text.includes('maintenance')) return 'Facilities Management'
  if (text.includes('machine learning') || text.includes('artificial intelligence') || text.includes('forecast')) return 'AI & Forecasting'
  if (text.includes('finance') || text.includes('econom')) return 'Economics & Finance'
  return 'General'
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [events, counts] = await Promise.all([
    supabase
      .from('pios_ingestion_events')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(20),
    Promise.all([
      supabase.from('pios_papers').select('id', { count: 'exact', head: true }),
      supabase.from('pios_authors').select('id', { count: 'exact', head: true }),
      supabase.from('pios_citations').select('id', { count: 'exact', head: true }),
    ]),
  ])

  return NextResponse.json({
    events: events.data ?? [],
    totals: {
      papers: counts[0].count ?? 0,
      authors: counts[1].count ?? 0,
      citations: counts[2].count ?? 0,
    },
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { literature_ids?: string[]; saved_only?: boolean }
  const ids = body.literature_ids ?? []

  let q = supabase
    .from('academic_literature')
    .select('id,doi,title,authors,year,journal,abstract,citation_count,source_api,pdf_url,unpaywall_oa_url')
    .eq('user_id', user.id)

  if (ids.length > 0) q = q.in('id', ids)
  if (body.saved_only !== false) q = q.eq('is_saved', true)

  const { data: litRows, error: litErr } = await q.limit(500)
  if (litErr) return NextResponse.json({ error: litErr.message }, { status: 500 })

  const rows = (litRows ?? []) as LitRow[]
  const { data: event } = await supabase
    .from('pios_ingestion_events')
    .insert({ user_id: user.id, papers_considered: rows.length, status: 'running' })
    .select('*')
    .single()

  let papersUpserted = 0
  let authorsUpserted = 0
  let linksUpserted = 0

  try {
    for (const row of rows) {
      const normalizedTitle = normalizeTitle(row.title)
      const keywords = inferKeywords(row.title)
      const field = inferField(row.journal, row.title)
      const source = row.source_api ? [row.source_api] : ['academic_literature']

      const { data: paper, error: paperErr } = await supabase
        .from('pios_papers')
        .upsert({
          doi: row.doi,
          title: row.title,
          title_normalized: normalizedTitle,
          authors: row.authors ?? [],
          publication_year: row.year,
          journal: row.journal,
          abstract_excerpt: row.abstract ? row.abstract.slice(0, 1200) : null,
          field_classifications: [field],
          keywords,
          open_access: Boolean(row.unpaywall_oa_url || row.pdf_url),
          free_pdf_url: row.unpaywall_oa_url ?? row.pdf_url,
          citation_count: row.citation_count ?? 0,
          sources: source,
        }, { onConflict: 'title_normalized' })
        .select('id')
        .single()

      if (paperErr || !paper?.id) continue
      papersUpserted += 1

      const authors = (row.authors ?? []).slice(0, 15)
      for (let i = 0; i < authors.length; i += 1) {
        const name = authors[i].trim()
        if (!name) continue
        const normalizedName = normalizeTitle(name)

        const { data: author } = await supabase
          .from('pios_authors')
          .upsert({
            name,
            normalized_name: normalizedName,
          }, { onConflict: 'normalized_name' })
          .select('id')
          .single()

        if (author?.id) {
          authorsUpserted += 1
          await supabase.from('pios_author_papers').upsert({
            author_id: author.id,
            paper_id: paper.id,
            author_position: i + 1,
          }, { onConflict: 'author_id,paper_id' })
          linksUpserted += 1
        }
      }

      // Upsert simple trend counters by keyword + year
      if (row.year) {
        for (const kw of keywords.slice(0, 5)) {
          const { data: existingTrend } = await supabase
            .from('pios_research_trends')
            .select('id,paper_count')
            .eq('field', field)
            .eq('keyword', kw)
            .eq('year', row.year)
            .maybeSingle()

          if (!existingTrend?.id) {
            await supabase.from('pios_research_trends').insert({
              field,
              keyword: kw,
              year: row.year,
              paper_count: 1,
              citation_growth: 0,
              emerging: false,
            })
          } else {
            await supabase
              .from('pios_research_trends')
              .update({ paper_count: (existingTrend.paper_count ?? 0) + 1 })
              .eq('id', existingTrend.id)
          }
        }
      }
    }

    if (event?.id) {
      await supabase
        .from('pios_ingestion_events')
        .update({
          papers_upserted: papersUpserted,
          authors_upserted: authorsUpserted,
          links_upserted: linksUpserted,
          completed_at: new Date().toISOString(),
          status: 'success',
        })
        .eq('id', event.id)
        .eq('user_id', user.id)
    }

    return NextResponse.json({
      ok: true,
      considered: rows.length,
      papers_upserted: papersUpserted,
      authors_upserted: authorsUpserted,
      links_upserted: linksUpserted,
      event_id: event?.id,
    })
  } catch (err: unknown) {
    if (event?.id) {
      await supabase
        .from('pios_ingestion_events')
        .update({
          completed_at: new Date().toISOString(),
          status: 'failed',
          notes: (err as Error)?.message ?? 'unknown error',
        })
        .eq('id', event.id)
        .eq('user_id', user.id)
    }

    return NextResponse.json({ error: (err as Error)?.message ?? 'Ingestion failed' }, { status: 500 })
  }
}
