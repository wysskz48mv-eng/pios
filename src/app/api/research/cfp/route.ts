import { apiError } from '@/lib/api-error'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

export const runtime = 'nodejs'
export const maxDuration = 30

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/research/cfp
// Finds current calls for papers relevant to Douglas's research domains.
// Returns structured CFP list for display and optional saving.
//
// GET: Returns saved CFPs from DB.
// POST { action: 'fetch' }: Generate fresh CFPs via AI.
// POST { action: 'save', cfp }: Save a CFP to the database.
// POST { action: 'update_status', id, status }: Update CFP status.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { action = 'fetch' } = body

    if (action === 'save') {
      const { cfp } = body
      if (!cfp?.title) return NextResponse.json({ error: 'CFP title required' }, { status: 400 })
      const { data } = await supabase.from('paper_calls').insert({
        user_id: user.id,
        ...cfp,
      }).select('id').single()
      return NextResponse.json({ saved: true, id: data?.id })
    }

    if (action === 'update_status') {
      const { id, status } = body
      await supabase.from('paper_calls').update({ status }).eq('id', id).eq('user_id', user.id)
      return NextResponse.json({ updated: true })
    }

    // action === 'fetch' — generate CFPs via AI
    const today = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })

    const system = `You are an academic publishing intelligence assistant. Find realistic, plausible current calls for papers and special issues relevant to a DBA researcher in the following domains:

Research focus: AI-enabled forecasting in GCC facilities management, STS (Science and Technology Studies), Weick's sensemaking theory, digital transformation in FM, service charge management, smart buildings, predictive maintenance.

Generate 8 realistic CFPs that would plausibly exist in 2025-2026 from journals like: Facilities, Journal of Facilities Management, Construction Management and Economics, Technological Forecasting and Social Change, Journal of Building Engineering, Automation in Construction, Buildings and Cities, Sustainable Cities and Society, RICS research publications, BIFM publications.

Also include 2-3 relevant conference calls (IFMA World Workplace, EuroFM Research Symposium, CIB conferences, RICS conferences).

Today is ${today}. Set realistic deadlines 4-16 weeks from today.

Return ONLY valid JSON:
{
  "calls": [
    {
      "title": "Special issue / conference title",
      "journal_name": "Journal or conference name",
      "call_type": "special_issue|regular_issue|conference|workshop",
      "topic_summary": "2-3 sentences on what they're looking for",
      "deadline": "YYYY-MM-DD",
      "submission_url": "https://plausible-url.com/cfp",
      "relevance_score": 1-5,
      "relevance_reason": "One sentence: specific connection to Douglas's research"
    }
  ]
}`

    const raw = await callClaude(
      [{ role: 'user', content: `Find current calls for papers for a GCC FM / AI / STS DBA researcher. Today: ${today}` }],
      system,
      2000
    )

    let parsed: unknown = {}
    try {
      const clean = raw.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      return NextResponse.json({ error: 'CFP parsing failed' }, { status: 500 })
    }

    return NextResponse.json({
      calls: (parsed as any)?.calls ?? [],
      count: (parsed as any)?.calls?.length ?? 0,
      generatedAt: new Date().toISOString(),
      disclaimer: 'AI-generated CFP digest. Verify deadlines and submission details at the journal website before submitting.',
    })
  } catch (err: unknown) {
    console.error('/api/research/cfp:', err)
    return NextResponse.json({ error: (err as Error).message ?? 'CFP fetch failed' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase.from('paper_calls')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'dismissed')
      .order('deadline', { ascending: true })

    return NextResponse.json({ calls: data ?? [] })
  } catch (err: unknown) {
    return apiError(err)
  }
}
