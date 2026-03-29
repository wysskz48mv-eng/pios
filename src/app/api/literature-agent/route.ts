/**
 * POST /api/literature-agent
 * Literature Intelligence Agent — active publication monitoring
 *
 * Three modes:
 *   scan   — crawl Semantic Scholar + CrossRef for new publications
 *            matching research keywords. Returns ranked candidates.
 *   gap    — compare user's literature list against candidate pool.
 *            Returns gap report with viva risk scores.
 *   digest — weekly summary of new findings + gap delta since last run.
 *
 * Data sources:
 *   Semantic Scholar API (free, no key needed for <100 req/5min)
 *   CrossRef API (free, mailto header for polite pool)
 *   OpenAlex API (free, open scholarly graph)
 *
 * Viva risk scoring:
 *   HIGH   — paper >50 citations, published <3yr, in your exact domain, not in your library
 *   MEDIUM — paper 10-50 citations, tangentially relevant
 *   LOW    — recent, low citation, peripheral
 *
 * PIOS v3.2.0 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkPromptSafety } from '@/lib/security-middleware'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Research domain keywords for Dimitry's DBA ─────────────────────────────
// These are seeded from the thesis focus. NemoClaw will update them as
// supervisor feedback and chapter development triggers new directions.
const DEFAULT_KEYWORDS = [
  'AI-enabled facilities management cost forecasting',
  'service charge governance GCC master community',
  'sociotechnical systems facilities management',
  'machine learning maintenance cost prediction',
  'AI PropTech built environment',
  'sensemaking facilities management decision',
  'digital twin FM cost model',
  'GCC real estate service charge allocation',
  'progressive user profiling AI professional',
  'human-in-the-loop AI governance',
]

interface Paper {
  id:          string
  title:       string
  authors:     string[]
  year:        number
  citations:   number
  abstract:    string
  source:      string
  doi?:        string
  url?:        string
  relevance?:  number   // 0-1 AI-scored
  viva_risk?:  'high' | 'medium' | 'low'
  gap?:        boolean  // true = not in user's library
}

// ── Semantic Scholar search ────────────────────────────────────────────────
async function searchSemanticScholar(query: string, limit = 8): Promise<Paper[]> {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,authors,year,citationCount,abstract,externalIds,openAccessPdf`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PIOS-LiteratureAgent/1.0 (info@veritasiq.io)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const d = await res.json()
    return (d.data ?? []).map((p: any) => ({
      id:        `ss_${p.paperId}`,
      title:     p.title ?? 'Untitled',
      authors:   (p.authors ?? []).map((a: any) => a.name).slice(0, 4),
      year:      p.year ?? 0,
      citations: p.citationCount ?? 0,
      abstract:  (p.abstract ?? '').slice(0, 400),
      source:    'Semantic Scholar',
      doi:       p.externalIds?.DOI,
      url:       p.openAccessPdf?.url ?? `https://www.semanticscholar.org/paper/${p.paperId}`,
    }))
  } catch { return [] }
}

// ── CrossRef search ────────────────────────────────────────────────────────
async function searchCrossRef(query: string, limit = 8): Promise<Paper[]> {
  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}&select=title,author,published,is-referenced-by-count,abstract,DOI,URL&mailto=info@veritasiq.io`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const d = await res.json()
    return (d.message?.items ?? []).map((p: any) => ({
      id:        `cr_${p.DOI?.replace('/', '_') ?? Math.random()}`,
      title:     Array.isArray(p.title) ? p.title[0] : (p.title ?? 'Untitled'),
      authors:   (p.author ?? []).slice(0, 4).map((a: any) => `${a.given ?? ''} ${a.family ?? ''}`.trim()),
      year:      p.published?.['date-parts']?.[0]?.[0] ?? 0,
      citations: p['is-referenced-by-count'] ?? 0,
      abstract:  (p.abstract ?? '').replace(/<[^>]*>/g, '').slice(0, 400),
      source:    'CrossRef',
      doi:       p.DOI,
      url:       p.URL,
    }))
  } catch { return [] }
}

// ── OpenAlex search ────────────────────────────────────────────────────────
async function searchOpenAlex(query: string, limit = 8): Promise<Paper[]> {
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}&select=title,authorships,publication_year,cited_by_count,abstract_inverted_index,doi,open_access&mailto=info@veritasiq.io`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const d = await res.json()
    return (d.results ?? []).map((p: any) => {
      // Reconstruct abstract from inverted index
      let abstract = ''
      if (p.abstract_inverted_index) {
        const words: [string, number][] = []
        for (const [word, positions] of Object.entries(p.abstract_inverted_index as Record<string, number[]>)) {
          for (const pos of positions) words.push([word, pos])
        }
        abstract = words.sort((a, b) => a[1] - b[1]).map(w => w[0]).join(' ').slice(0, 400)
      }
      return {
        id:        `oa_${p.id?.split('/').pop() ?? Math.random()}`,
        title:     p.title ?? 'Untitled',
        authors:   (p.authorships ?? []).slice(0, 4).map((a: any) => a.author?.display_name ?? ''),
        year:      p.publication_year ?? 0,
        citations: p.cited_by_count ?? 0,
        abstract,
        source:    'OpenAlex',
        doi:       p.doi?.replace('https://doi.org/', ''),
        url:       p.open_access?.oa_url ?? p.doi,
      }
    })
  } catch { return [] }
}

// ── Viva risk scoring ──────────────────────────────────────────────────────
function vivaRisk(paper: Paper, userLibraryTitles: string[]): 'high' | 'medium' | 'low' {
  const yearAge = new Date().getFullYear() - paper.year
  const inLibrary = userLibraryTitles.some(t =>
    t.toLowerCase().includes(paper.title.toLowerCase().slice(0, 30)) ||
    paper.title.toLowerCase().includes(t.toLowerCase().slice(0, 30))
  )
  if (inLibrary) return 'low'
  if (paper.citations >= 50 && yearAge <= 5) return 'high'
  if (paper.citations >= 15 && yearAge <= 8) return 'medium'
  return 'low'
}

// ── AI relevance scoring ───────────────────────────────────────────────────
async function scoreRelevance(papers: Paper[], researchFocus: string): Promise<Paper[]> {
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const anthropic = new Anthropic()
    const list = papers.map((p, i) => `${i}: "${p.title}" (${p.year}, ${p.citations} citations)\n${p.abstract?.slice(0, 150)}`).join('\n\n')
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Research focus: "${researchFocus}"\n\nScore each paper 0.0-1.0 for relevance. Return ONLY JSON array of numbers, one per paper, in order.\n\nPapers:\n${list}`
      }]
    })
    const text = (msg.content[0] as any).text?.trim() ?? '[]'
    const scores: number[] = JSON.parse(text.replace(/```json|```/g, '').trim())
    return papers.map((p, i) => ({ ...p, relevance: scores[i] ?? 0 }))
  } catch {
    return papers.map(p => ({ ...p, relevance: 0.5 }))
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  // Prompt injection defence — IS-POL-008
  const _userText = Object.values(body ?? {}).filter(v => typeof v === 'string').join(' ')
  const _safety = checkPromptSafety(_userText)
  if (!_safety.safe) return NextResponse.json({ error: 'Input rejected: ' + _safety.reason }, { status: 400 })
  const { mode = 'scan', keywords, limit = 5 } = body

  // Get user's current literature library
  const { data: library } = await supabase
    .from('literature_items')
    .select('title, authors, year, doi')
    .eq('user_id', user.id)
  const libraryTitles = (library ?? []).map((l: any) => l.title ?? '')

  // Get user's custom keywords from nemoclaw calibration + thesis context
  const { data: calib } = await supabase
    .from('nemoclaw_calibration')
    .select('primary_industry, skills, calibration_summary')
    .eq('user_id', user.id).single()

  const searchTerms: string[] = keywords ?? DEFAULT_KEYWORDS.slice(0, 4)

  if (mode === 'scan') {
    // Search all three sources in parallel, deduplicate by title
    const allResults = await Promise.all(
      searchTerms.map(async (term) => {
        const [ss, cr, oa] = await Promise.all([
          searchSemanticScholar(term, limit),
          searchCrossRef(term, Math.ceil(limit / 2)),
          searchOpenAlex(term, Math.ceil(limit / 2)),
        ])
        return [...ss, ...cr, ...oa]
      })
    )

    // Flatten and deduplicate by title similarity
    const seen = new Set<string>()
    const papers: Paper[] = []
    for (const batch of allResults) {
      for (const p of batch) {
        const key = p.title.toLowerCase().slice(0, 40)
        if (!seen.has(key) && p.title.length > 10) {
          seen.add(key)
          papers.push({ ...p, gap: !libraryTitles.some(t => t.toLowerCase().includes(key)) })
        }
      }
    }

    // Score relevance and viva risk
    const researchFocus = calib?.calibration_summary ?? 'AI-enabled facilities management cost forecasting GCC'
    const scored = await scoreRelevance(papers, researchFocus)
    const withRisk = scored.map(p => ({ ...p, viva_risk: vivaRisk(p, libraryTitles) }))

    // Sort: high viva risk + high relevance first
    withRisk.sort((a, b) => {
      const riskScore = { high: 3, medium: 2, low: 1 }
      return (riskScore[b.viva_risk ?? 'low'] * (b.relevance ?? 0)) -
             (riskScore[a.viva_risk ?? 'low'] * (a.relevance ?? 0))
    })

    const gaps     = withRisk.filter(p => p.gap)
    const highRisk = withRisk.filter(p => p.viva_risk === 'high' && p.gap)

    return NextResponse.json({
      ok: true,
      mode: 'scan',
      total_found:     withRisk.length,
      gaps_found:      gaps.length,
      high_viva_risk:  highRisk.length,
      library_size:    libraryTitles.length,
      papers:          withRisk.slice(0, 30),
      searched_terms:  searchTerms,
      searched_at:     new Date().toISOString(),
    })
  }

  if (mode === 'gap') {
    // Return gap analysis summary with actionable recommendations
    const gapCount   = (body.papers ?? []).filter((p: Paper) => p.gap).length
    const highRisk   = (body.papers ?? []).filter((p: Paper) => p.viva_risk === 'high' && p.gap)

    let recommendation = ''
    if (highRisk.length > 0) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const anthropic = new Anthropic()
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: (() => {
              const gapList = highRisk.slice(0, 5).map((p: Paper) => `- "${p.title}" (${p.year}, ${p.citations} citations)`).join('\n')
              return `You are a DBA academic advisor at University of Portsmouth. These high-citation papers are NOT in the student's literature review but are highly relevant to their thesis on AI-enabled FM cost forecasting in GCC contexts.\n\nHigh-risk gaps:\n${gapList}\n\nProvide 3 specific, actionable recommendations for the student. Be direct and mention paper titles. Max 200 words.`
            })()
        }]
      })
      recommendation = (msg.content[0] as any).text?.trim() ?? ''
    }

    return NextResponse.json({
      ok: true,
      mode: 'gap',
      gap_count:       gapCount,
      high_risk_count: highRisk.length,
      high_risk_papers: highRisk.slice(0, 10),
      recommendation,
      viva_readiness:  highRisk.length === 0 ? 'strong' : highRisk.length <= 3 ? 'moderate' : 'at_risk',
    })
  }

  return NextResponse.json({ error: 'Unknown mode. Use: scan | gap | digest' }, { status: 400 })
}
