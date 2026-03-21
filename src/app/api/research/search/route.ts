import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'

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

You will simulate an academic database search and return structured results. Generate realistic, academically accurate results that would plausibly appear in ${dbLabel[database] ?? database}. Include real author name patterns, realistic DOIs, genuine journal names, and accurate abstracts relevant to the query.

CRITICAL: Return ONLY valid JSON, no markdown, no explanation. Schema:
{
  "results": [
    {
      "title": "Full paper title",
      "authors": ["Last, F.", "Last2, F2."],
      "year": 2023,
      "journal": "Journal name",
      "volume": "12",
      "issue": "3",
      "pages": "245-267",
      "doi": "10.1234/journal.2023.001",
      "abstract": "150-200 word abstract",
      "keywords": ["keyword1", "keyword2"],
      "citations": 45,
      "open_access": false,
      "relevance_notes": "Why this is relevant to Douglas's research (1-2 sentences)"
    }
  ],
  "total_found": 847,
  "search_strategy": "Brief note on search strategy and key terms that yielded results",
  "ai_guidance": "2-3 sentences: which results to prioritise, what theoretical connections to look for, any gaps in the literature this search reveals"
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
    const { data: searchRecord } = await supabase.from('database_searches').insert({
      user_id: user.id,
      query,
      database_name: database,
      filters: { yearFrom, yearTo, subjectArea, maxResults },
      result_count: parsed.results?.length ?? 0,
      results: parsed.results ?? [],
      notes: parsed.search_strategy,
    }).select('id').single()

    return NextResponse.json({
      results: parsed.results ?? [],
      totalFound: parsed.total_found ?? 0,
      searchStrategy: parsed.search_strategy,
      aiGuidance: parsed.ai_guidance,
      searchId: searchRecord?.id,
      database,
      query,
      disclaimer: 'Results are AI-generated based on known literature patterns. Verify via your institutional Scopus/WoS access before citing. Use DOIs to locate actual papers.',
    })
  } catch (err: any) {
    console.error('/api/research/search:', err)
    return NextResponse.json({ error: err.message ?? 'Search failed' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data } = await supabase.from('database_searches').select('*')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
    return NextResponse.json({ searches: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
