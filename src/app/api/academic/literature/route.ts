/**
 * /api/academic/literature — Literature Discovery (M059)
 * =========================================================
 * Search across Semantic Scholar, OpenAlex, arXiv, Crossref.
 * Save papers, generate bibliographies, link to thesis chapters.
 *
 * PIOS v3.0 | VeritasIQ Technologies Ltd
 */

import { NextRequest, NextResponse }          from 'next/server'
import { createClient }                        from '@/lib/supabase/server'
import { callClaude, PIOS_SYSTEM }             from '@/lib/ai/client'

export const runtime = 'nodejs'

// ── External API result shape ─────────────────────────────────────────────────
interface LitResult {
  title:               string
  authors:             string[]
  year:                number | null
  abstract:            string | null
  doi:                 string | null
  arxiv_id:            string | null
  semantic_scholar_id: string | null
  openalex_id:         string | null
  journal:             string | null
  venue:               string | null
  source_api:          string
  citation_count:      number
  pdf_url:             string | null
  relevance_score:     number | null
}

// ── Semantic Scholar ──────────────────────────────────────────────────────────
async function searchSemanticScholar(query: string, limit = 15): Promise<LitResult[]> {
  try {
    const fields = 'title,authors,year,abstract,citationCount,externalIds,isOpenAccess,openAccessPdf,venue,journal'
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`
    const r = await fetch(url, { headers: { 'User-Agent': 'PIOS/3.0 (academic research tool)' }, signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const data = await r.json() as { data?: Record<string, unknown>[] }
    return (data.data ?? []).map(p => ({
      title:               String(p.title ?? ''),
      authors:             ((p.authors as { name: string }[]) ?? []).map(a => a.name),
      year:                p.year as number ?? null,
      abstract:            p.abstract as string ?? null,
      doi:                 (p.externalIds as Record<string, string>)?.DOI ?? null,
      arxiv_id:            (p.externalIds as Record<string, string>)?.ArXiv ?? null,
      semantic_scholar_id: p.paperId as string ?? null,
      openalex_id:         null,
      journal:             (p.journal as { name: string })?.name ?? null,
      venue:               p.venue as string ?? null,
      source_api:          'semantic_scholar',
      citation_count:      p.citationCount as number ?? 0,
      pdf_url:             (p.openAccessPdf as { url: string })?.url ?? null,
      relevance_score:     null,
    }))
  } catch { return [] }
}

// ── OpenAlex ─────────────────────────────────────────────────────────────────
function reconstructAbstract(invertedIndex: Record<string, number[]> | null): string | null {
  if (!invertedIndex) return null
  const words: string[] = []
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) words[pos] = word
  }
  return words.filter(Boolean).join(' ')
}

async function searchOpenAlex(query: string, limit = 15): Promise<LitResult[]> {
  try {
    const select = 'id,title,authorships,publication_year,abstract_inverted_index,doi,primary_location,cited_by_count,open_access'
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}&select=${select}&mailto=support@veritasiq.io`
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const data = await r.json() as { results?: Record<string, unknown>[] }
    return (data.results ?? []).map(p => {
      const authors = ((p.authorships as { author: { display_name: string } }[]) ?? []).map(a => a.author?.display_name).filter(Boolean)
      const loc = p.primary_location as Record<string, unknown> ?? {}
      const oa  = p.open_access as Record<string, unknown> ?? {}
      return {
        title:               String(p.title ?? ''),
        authors,
        year:                p.publication_year as number ?? null,
        abstract:            reconstructAbstract(p.abstract_inverted_index as Record<string, number[]>),
        doi:                 p.doi as string ?? null,
        arxiv_id:            null,
        semantic_scholar_id: null,
        openalex_id:         p.id as string ?? null,
        journal:             (loc.source as Record<string, string>)?.display_name ?? null,
        venue:               null,
        source_api:          'openalex',
        citation_count:      p.cited_by_count as number ?? 0,
        pdf_url:             oa.oa_url as string ?? null,
        relevance_score:     null,
      }
    })
  } catch { return [] }
}

// ── arXiv ─────────────────────────────────────────────────────────────────────
async function searchArxiv(query: string, limit = 10): Promise<LitResult[]> {
  try {
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${limit}&sortBy=relevance`
    const r = await fetch(url, { headers: { 'Accept': 'application/xml' }, signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const xml = await r.text()
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []
    return entries.map(entry => {
      const get  = (tag: string) => entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim() ?? null
      const getAll = (tag: string) => [...entry.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g'))].map(m => m[1].trim())
      const id   = get('id') ?? ''
      const doi  = entry.match(/<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/)?.[1]?.trim() ?? null
      const year = get('published')?.slice(0, 4) ? parseInt(get('published')!.slice(0, 4)) : null
      return {
        title:               get('title')?.replace(/\s+/g, ' ') ?? '',
        authors:             getAll('name'),
        year,
        abstract:            get('summary')?.replace(/\s+/g, ' ') ?? null,
        doi,
        arxiv_id:            id.split('/abs/').pop() ?? null,
        semantic_scholar_id: null,
        openalex_id:         null,
        journal:             null,
        venue:               'arXiv',
        source_api:          'arxiv',
        citation_count:      0,
        pdf_url:             id.replace('/abs/', '/pdf/') + '.pdf',
        relevance_score:     null,
      }
    })
  } catch { return [] }
}

// ── Crossref ──────────────────────────────────────────────────────────────────
async function searchCrossref(query: string, limit = 10): Promise<LitResult[]> {
  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}&mailto=support@veritasiq.io`
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const data = await r.json() as { message?: { items?: Record<string, unknown>[] } }
    return (data.message?.items ?? []).map(p => {
      const authors = ((p.author as { given?: string; family?: string }[]) ?? []).map(a => [a.given, a.family].filter(Boolean).join(' '))
      const pub     = ((p['published-print'] ?? p['published-online']) as { 'date-parts': number[][] } | null)
      const year    = pub?.['date-parts']?.[0]?.[0] ?? null
      return {
        title:               ((p.title as string[]) ?? [])[0] ?? '',
        authors,
        year,
        abstract:            p.abstract as string ?? null,
        doi:                 p.DOI as string ?? null,
        arxiv_id:            null,
        semantic_scholar_id: null,
        openalex_id:         null,
        journal:             ((p['container-title'] as string[]) ?? [])[0] ?? null,
        venue:               null,
        source_api:          'crossref',
        citation_count:      p['is-referenced-by-count'] as number ?? 0,
        pdf_url:             null,
        relevance_score:     null,
      }
    })
  } catch { return [] }
}

// ── Scopus API search (Phase 2 — only when institutional API key is set) ──────
interface ScopusEntry {
  'dc:title'?: string
  'dc:creator'?: string
  'prism:coverDate'?: string
  'prism:publicationName'?: string
  'citedby-count'?: string
  'prism:doi'?: string
  eid?: string
  'dc:description'?: string
  openaccess?: string
  link?: { '@ref': string; '@href': string }[]
}

async function searchScopusAPI(
  query: string,
  apiKey: string,
  endpoint: string,
  limit = 15
): Promise<LitResult[]> {
  try {
    const url = new URL(`${endpoint}`)
    url.searchParams.set('query', query)
    url.searchParams.set('count', String(limit))
    url.searchParams.set('sort', 'relevance')
    const r = await fetch(url.toString(), {
      headers: { 'X-ELS-APIKey': apiKey, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) return []
    const data = await r.json() as { 'search-results'?: { entry?: ScopusEntry[] } }
    const entries = data['search-results']?.entry ?? []
    return entries.map(e => ({
      title:               e['dc:title'] ?? '',
      authors:             e['dc:creator'] ? [e['dc:creator']] : [],
      year:                e['prism:coverDate'] ? parseInt(e['prism:coverDate'].split('-')[0]) : null,
      abstract:            e['dc:description'] ?? null,
      doi:                 e['prism:doi'] ?? null,
      arxiv_id:            null,
      semantic_scholar_id: null,
      openalex_id:         null,
      journal:             e['prism:publicationName'] ?? null,
      venue:               null,
      source_api:          'scopus',
      citation_count:      e['citedby-count'] ? parseInt(e['citedby-count']) : 0,
      pdf_url:             e.link?.find(l => l['@ref'] === 'scopus')?.['@href'] ?? null,
      relevance_score:     null,
    }))
  } catch { return [] }
}

// ── Unpaywall PDF lookup ───────────────────────────────────────────────────────
async function fetchUnpaywall(doi: string): Promise<string | null> {
  try {
    const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=support@veritasiq.io`
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!r.ok) return null
    const data = await r.json() as { best_oa_location?: { url_for_pdf?: string } }
    return data.best_oa_location?.url_for_pdf ?? null
  } catch { return null }
}

// ── Claude relevance scoring ──────────────────────────────────────────────────
async function scoreRelevance(
  results: LitResult[],
  query: string,
  thesisContext: string
): Promise<LitResult[]> {
  if (results.length === 0) return results
  try {
    const prompt = `Rate the relevance of these papers to the research query and thesis context.

QUERY: ${query}
THESIS: ${thesisContext}

PAPERS:
${results.map((p, i) => `[${i}] "${p.title}" (${p.year}) — ${p.abstract?.slice(0, 200) ?? 'No abstract'}`).join('\n')}

Return a JSON array of relevance scores (0.0-1.0) in the same order, e.g. [0.9, 0.4, 0.7].
Return ONLY the JSON array.`
    const raw   = await callClaude([{ role: 'user', content: prompt }], PIOS_SYSTEM, 200, 'haiku')
    const match = raw.match(/\[[\d.,\s]+\]/)
    if (!match) return results
    const scores = JSON.parse(match[0]) as number[]
    return results.map((p, i) => ({ ...p, relevance_score: scores[i] ?? null }))
  } catch { return results }
}

// ── Bibliography formatting ───────────────────────────────────────────────────
function formatCitation(p: LitResult, style: string): string {
  const authors = p.authors.length > 0
    ? p.authors.length > 3
      ? `${p.authors[0]} et al.`
      : p.authors.join(style === 'apa' ? ', ' : ' and ')
    : 'Unknown'
  const year  = p.year ?? 'n.d.'
  const title = p.title
  const journal = p.journal ?? p.venue ?? ''
  const doi   = p.doi ? ` https://doi.org/${p.doi}` : p.pdf_url ? ` ${p.pdf_url}` : ''

  if (style === 'chicago') {
    return `${authors}. "${title}." ${journal ? `*${journal}* ` : ''}(${year}).${doi}`
  }
  if (style === 'harvard') {
    return `${authors} (${year}) '${title}', ${journal ? `*${journal}*.` : ''}${doi}`
  }
  // APA default
  return `${authors} (${year}). ${title}. ${journal ? `*${journal}*.` : ''}${doi}`
}

// ── GET — list saved literature ───────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const chapterId = searchParams.get('chapter_id')
    const savedOnly = searchParams.get('saved') === 'true'
    const tag       = searchParams.get('tag')

    let q = supabase
      .from('academic_literature')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (savedOnly) q = q.eq('is_saved', true)
    if (chapterId) q = q.eq('linked_chapter_id', chapterId)
    if (tag)       q = q.contains('tags', [tag])

    const { data, error } = await q
    if (error) throw error

    // Fetch glossary stats and analysis summary counts
    const ids = (data ?? []).map(r => r.id as string)
    const [glossaryCounts, analysisCounts] = await Promise.all([
      ids.length === 0 ? Promise.resolve({ data: [] }) :
        supabase.from('paper_glossary').select('literature_id').in('literature_id', ids),
      ids.length === 0 ? Promise.resolve({ data: [] }) :
        supabase.from('paper_analysis').select('literature_id, thesis_alignment_score, study_quality_score').in('literature_id', ids),
    ])
    const glossaryMap = new Map<string, number>()
    for (const r of glossaryCounts.data ?? []) glossaryMap.set(r.literature_id as string, (glossaryMap.get(r.literature_id as string) ?? 0) + 1)
    const analysisMap = new Map<string, { thesis_alignment_score: number; study_quality_score: number }>()
    for (const r of analysisCounts.data ?? []) analysisMap.set(r.literature_id as string, r as { thesis_alignment_score: number; study_quality_score: number })

    const enriched = (data ?? []).map(r => ({
      ...r,
      glossary_count:        glossaryMap.get(r.id as string) ?? 0,
      thesis_alignment_score: analysisMap.get(r.id as string)?.thesis_alignment_score ?? null,
      study_quality_score:    analysisMap.get(r.id as string)?.study_quality_score ?? null,
    }))

    return NextResponse.json({ literature: enriched, total: enriched.length })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal error' }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body   = await req.json() as Record<string, unknown>
    const action = body.action as string

    // ─── action: search ───────────────────────────────────────────────────────
    if (action === 'search') {
      const query   = String(body.query ?? '').trim()
      const sources = (body.sources as string[]) ?? ['semantic_scholar', 'openalex', 'arxiv', 'crossref']
      if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

      // Pull thesis context from research_context (M058); fall back to caller-supplied or default
      let thesisContext = String(body.thesis_context ?? '')
      if (!thesisContext) {
        const { data: ctx } = await supabase.from('research_context').select('thesis_synopsis,research_topic,keywords').eq('user_id', user.id).single()
        if (ctx) {
          thesisContext = [ctx.thesis_synopsis, ctx.research_topic, (ctx.keywords as string[]).join(', ')].filter(Boolean).join(' | ')
        } else {
          thesisContext = 'AI-enabled forecasting in FM contexts, GCC, DBA research'
        }
      }

      // Check institutional Scopus access
      const { data: instAccess } = await supabase
        .from('user_institutional_access')
        .select('*, institution:institutional_scopus_config(*)')
        .eq('user_id', user.id)
        .maybeSingle()

      const hasScopusAPI = instAccess?.api_access_enabled && (instAccess?.institution as Record<string, unknown>)?.scopus_api_key_enc
      const hasScopusRedirect = instAccess?.scopus_access && !hasScopusAPI          // Phase 1
      const scopusInfo = instAccess?.scopus_access ? {
        has_access:         true,
        institution:        instAccess.institution_name,
        method:             hasScopusAPI ? 'api' : 'redirect',
        redirect_url:       instAccess.web_access_url,
        api_enabled:        hasScopusAPI ?? false,
      } : { has_access: false }

      // Run searches in parallel — skip any source not in the requested set
      const [ss, oa, ax, cr] = await Promise.all([
        sources.includes('semantic_scholar') ? searchSemanticScholar(query) : Promise.resolve([]),
        sources.includes('openalex')         ? searchOpenAlex(query)        : Promise.resolve([]),
        sources.includes('arxiv')            ? searchArxiv(query)           : Promise.resolve([]),
        sources.includes('crossref')         ? searchCrossref(query)        : Promise.resolve([]),
      ])

      // Phase 2: direct Scopus API if institutional key available
      let scopusResults: LitResult[] = []
      if (hasScopusAPI && sources.includes('scopus')) {
        const inst = instAccess!.institution as Record<string, unknown>
        scopusResults = await searchScopusAPI(
          query,
          String(inst.scopus_api_key_enc ?? ''),    // decryption would happen here in production
          String(inst.scopus_api_endpoint ?? 'https://api.elsevier.com/content/search/scopus'),
        )
        // Audit log
        await supabase.from('scopus_search_log').insert({
          user_id:        user.id,
          institution_id: instAccess?.institution_id,
          query,
          results_count:  scopusResults.length,
          method:         'api',
        })
      } else if (hasScopusRedirect && body.log_scopus_redirect) {
        await supabase.from('scopus_search_log').insert({
          user_id:        user.id,
          institution_id: instAccess?.institution_id,
          query,
          results_count:  0,
          method:         'redirect',
        })
      }

      // Deduplicate by DOI, then by title prefix
      const seen = new Set<string>()
      const combined: LitResult[] = []
      for (const p of [...ss, ...oa, ...ax, ...cr, ...scopusResults]) {
        const key = p.doi ?? p.title.toLowerCase().slice(0, 40)
        if (!seen.has(key)) { seen.add(key); combined.push(p) }
      }

      // Score relevance with Claude (haiku for speed/cost)
      const scored = await scoreRelevance(combined, query, thesisContext)
      scored.sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0))

      // Log search
      const sourcesUsed = [...sources, ...(scopusResults.length > 0 ? ['scopus'] : [])]
      await supabase.from('literature_search_history').insert({
        user_id:          user.id,
        query,
        filters:          { sources: sourcesUsed, thesis_context: thesisContext },
        result_count:     scored.length,
        sources_searched: sourcesUsed,
      })

      return NextResponse.json({
        results:      scored,
        total:        scored.length,
        sources_used: sourcesUsed,
        scopus:       scopusInfo,
      })
    }

    // ─── action: save ─────────────────────────────────────────────────────────
    if (action === 'save') {
      const paper = body.paper as LitResult
      if (!paper?.title) return NextResponse.json({ error: 'paper.title required' }, { status: 400 })

      // Check Unpaywall for free PDF if DOI present but no PDF URL
      let pdfUrl = paper.pdf_url
      if (!pdfUrl && paper.doi) pdfUrl = await fetchUnpaywall(paper.doi)

      const { data, error } = await supabase.from('academic_literature').upsert({
        user_id:             user.id,
        title:               paper.title,
        authors:             paper.authors ?? [],
        year:                paper.year,
        abstract:            paper.abstract,
        doi:                 paper.doi,
        arxiv_id:            paper.arxiv_id,
        semantic_scholar_id: paper.semantic_scholar_id,
        openalex_id:         paper.openalex_id,
        journal:             paper.journal,
        venue:               paper.venue,
        source_api:          paper.source_api ?? 'manual',
        relevance_score:     paper.relevance_score,
        pdf_url:             pdfUrl,
        unpaywall_oa_url:    pdfUrl !== paper.pdf_url ? pdfUrl : null,
        citation_count:      paper.citation_count ?? 0,
        is_saved:            true,
        raw_metadata:        body.raw_metadata ?? {},
      }, { onConflict: 'user_id,doi', ignoreDuplicates: false })
      if (error) throw error

      return NextResponse.json({ ok: true, paper: data })
    }

    // ─── action: bibliography ─────────────────────────────────────────────────
    if (action === 'bibliography') {
      const ids   = (body.literature_ids as string[]) ?? []
      const style = String(body.style ?? 'apa')
      if (!['apa', 'chicago', 'harvard'].includes(style))
        return NextResponse.json({ error: 'style must be apa|chicago|harvard' }, { status: 400 })
      if (ids.length === 0) return NextResponse.json({ error: 'literature_ids required' }, { status: 400 })

      const { data, error } = await supabase
        .from('academic_literature')
        .select('*')
        .eq('user_id', user.id)
        .in('id', ids)
      if (error) throw error

      const citations: { id: string; citation: string }[] = []
      const rows: { user_id: string; literature_id: string; citation_style: string; citation_text: string; chapter_id: string | null }[] = []

      for (const row of data ?? []) {
        const lit: LitResult = {
          title:               row.title as string,
          authors:             (row.authors as string[]) ?? [],
          year:                row.year as number ?? null,
          abstract:            null,
          doi:                 row.doi as string ?? null,
          arxiv_id:            row.arxiv_id as string ?? null,
          semantic_scholar_id: null,
          openalex_id:         null,
          journal:             row.journal as string ?? null,
          venue:               row.venue as string ?? null,
          source_api:          row.source_api as string,
          citation_count:      row.citation_count as number ?? 0,
          pdf_url:             row.pdf_url as string ?? null,
          relevance_score:     null,
        }
        const text = formatCitation(lit, style)
        citations.push({ id: row.id as string, citation: text })
        rows.push({
          user_id:        user.id,
          literature_id:  row.id as string,
          citation_style: style,
          citation_text:  text,
          chapter_id:     body.chapter_id as string ?? null,
        })
      }

      // Upsert formatted citations
      await supabase.from('literature_citations').upsert(rows, { onConflict: 'literature_id,citation_style', ignoreDuplicates: false })

      const formatted = citations.map(c => c.citation).join('\n\n')
      return NextResponse.json({ citations, formatted, style, count: citations.length })
    }

    // ─── action: link_chapter ─────────────────────────────────────────────────
    if (action === 'link_chapter') {
      const { literature_id, chapter_id } = body as { literature_id: string; chapter_id: string | null }
      if (!literature_id) return NextResponse.json({ error: 'literature_id required' }, { status: 400 })
      const { error } = await supabase
        .from('academic_literature')
        .update({ linked_chapter_id: chapter_id ?? null })
        .eq('id', literature_id)
        .eq('user_id', user.id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ─── action: pdf ──────────────────────────────────────────────────────────
    if (action === 'pdf') {
      const doi = String(body.doi ?? '').trim()
      if (!doi) return NextResponse.json({ error: 'doi required' }, { status: 400 })
      const url = await fetchUnpaywall(doi)
      if (!url) return NextResponse.json({ pdf_url: null, message: 'No open-access PDF found for this DOI' })
      return NextResponse.json({ pdf_url: url })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal error' }, { status: 500 })
  }
}

// ── DELETE — remove saved paper ───────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await req.json() as { id: string }
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { error } = await supabase
      .from('academic_literature')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal error' }, { status: 500 })
  }
}
