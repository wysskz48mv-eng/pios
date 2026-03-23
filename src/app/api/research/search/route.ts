import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

export const runtime = 'nodejs'
export const maxDuration = 30

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/research/search
// Runs a structured academic search using AI + web search simulation.
// Searches Scopus/Google Scholar/Emerald via AI-generated structured results.
// Logs search to database_searches table.
//
// Body: { query, database, yearFrom, yearTo, subjectArea, maxResults }
// Returns: { results: SearchResult[], totalFound, searchId, ai_guidance }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { query, database = 'scopus', yearFrom, yearTo, subjectArea, maxResults = 10 } = await request.json()
    if (!query?.trim()) return NextResponse.json({ error: 'Query required' }, { status: 400 })

    // Build filter description for the AI
    const filters = [
      yearFrom && `from ${yearFrom}`,
      yearTo && `to ${yearTo}`,
      subjectArea && `subject: ${subjectArea}`,
    ].filter(Boolean).join(', ')

    const dbLabel: Record<string, string> = {
      scopus: 'Scopus',
      google_scholar: 'Google Scholar',
      web_of_science: 'Web of Science',
      emerald: 'Emerald Insight',
      taylor_francis: 'Taylor & Francis Online',
      ieee: 'IEEE Xplore',
    }

    const system = `You are an academic research assistant helping Douglas Masuku, a DBA candidate at the University of Portsmouth researching AI-enabled forecasting in GCC (Gulf Cooperation Council) facilities management contexts. His theoretical framework uses Science and Technology Studies (STS) and Weick's sensemaking theory. His key topics: AI adoption in FM, predictive maintenance, service charge management, smart buildings GCC, digital twin FM.

IMPORTANT GROUNDING RULES — follow these strictly to prevent hallucination:
1. Only suggest papers you have high confidence actually exist. If uncertain, set confidence below 60.
2. Do NOT fabricate DOIs. Only include a DOI if you are highly confident it is real and accurate. Use null if uncertain.
3. Do NOT fabricate specific page numbers, volume/issue numbers, or citation counts. Use null if uncertain.
4. Set ai_generated: true on every result — these are AI suggestions requiring verification, not confirmed sources.
5. Set confidence 0-100: use 80+ only for papers you are very confident exist with correct metadata.
6. Lower confidence (40-60) for papers where you are less certain of exact details.

CRITICAL: Return ONLY valid JSON, no markdown, no explanation. Schema:
{
  "results": [
    {
      "title": "Full paper title",
      "authors": ["Last, F.", "Last2, F2."],
      "year": 2023,
      "journal": "Journal name",
      "volume": null,
      "issue": null,
      "pages": null,
      "doi": null,
      "abstract": "150-200 word abstract",
      "keywords": ["keyword1", "keyword2"],
      "citations": null,
      "open_access": false,
      "relevance_notes": "Why this is relevant to Douglas's research (1-2 sentences)",
      "confidence": 75,
      "ai_generated": true,
      "verification_required": true
    }
  ],
  "total_found": 847,
  "search_strategy": "Brief note on search strategy and key terms that yielded results",
  "ai_guidance": "2-3 sentences: which results to prioritise, what theoretical connections to look for, any gaps in the literature this search reveals",
  "grounding_note": "These results are AI-generated suggestions. Verify each paper exists using the DOI (if provided) or by searching the actual database before citing."
}`

    const userPrompt = `Search query: "${query}"
Database: ${dbLabel[database] ?? database}
Filters: ${filters || 'none'}
Max results to return: ${maxResults}
Context: DBA research on AI-enabled forecasting in GCC FM, STS theory, sensemaking framework`

    const raw = await callClaude(
      [{ role: 'user', content: userPrompt }],
      system,
      2000
    )

    let parsed: any = {}
    try {
      const clean = raw.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      return NextResponse.json({ error: 'Search result parsing failed. Try a more specific query.' }, { status: 500 })
    }

    // Log search to DB
  try {
      const { data: searchRecord } = await supabase.from('database_searches').insert({
        user_id: user.id,
        query,
        database_name: database,
        filters: { yearFrom, yearTo, subjectArea, maxResults },
        result_count: parsed.results?.length ?? 0,
        results: parsed.results ?? [],
        notes: parsed.search_strategy,
      }).select('id').single()

      // Run citation guard on DOI-bearing results (non-fatal)
      let guardSummary = null
      const toVerify = (parsed.results ?? []).filter((r: Record<string, unknown>) => r.doi)
      if (toVerify.length > 0) {
        try {
          const { verifyCitations } = await import('@/lib/citation-guard')
          const guardReport = await verifyCitations(toVerify.map((r: Record<string, unknown>) => ({
            title: r.title, authors: r.authors ?? [], year: r.year,
            journal: r.journal, doi: r.doi,
          })))
          // Stamp provenance onto each result
          for (const r of (parsed.results ?? [])) {
            const vr = guardReport.results.find((v: unknown) =>
              v.input.doi === r.doi && r.doi
            )
            if (vr) {
              r.provenance_label  = vr.provenance_label
              r.doi_verified      = vr.doi_verified
              r.confidence        = vr.confidence
              r.crossref_title    = vr.crossref_title
              r.requires_hitl     = vr.requires_hitl
              r.hitl_reason       = vr.hitl_reason
              r.verification_note = vr.verification_note
            }
          }
          guardSummary = {
            verified: guardReport.verified,
            needs_review: guardReport.needs_review,
            fabricated_risk: guardReport.fabricated_risk,
            hitl_required: guardReport.hitl_required,
            warning: guardReport.warning,
          }
        } catch { /* guard non-fatal */ }
      }

      return NextResponse.json({
        results: parsed.results ?? [],
        totalFound: parsed.total_found ?? 0,
        searchStrategy: parsed.search_strategy,
        aiGuidance: parsed.ai_guidance,
        searchId: searchRecord?.id,
        database,
        query,
        guardSummary,
        disclaimer: 'AI-generated suggestions — verify each paper exists before citing. Papers marked ✓ AI-Verified have been cross-checked against CrossRef. Papers marked ✗ Verify manually were not found in CrossRef.',
      })
    } catch (err: unknown) {
      console.error('/api/research/search:', err)
      return NextResponse.json({ error: err.message ?? 'Search failed' }, { status: 500 })
    }

  } catch (err: unknown) {
    console.error('[PIOS] research/search POST:', err.message)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }}

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data } = await supabase.from('database_searches').select('*')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
    return NextResponse.json({ searches: data ?? [], history: data ?? [] })
  } catch (err: unknown) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
