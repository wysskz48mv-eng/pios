/**
 * /api/sia — SIA™ Strategic Intelligence Agent
 * Proactive sector-configurable signal briefs for executive persona
 * PIOS Sprint 24 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'

export const runtime    = 'nodejs'
export const maxDuration = 60

// Default executive sector topics — user can override
const EXEC_SECTORS = [
  { key: 'strategy',    label: 'Strategy & Leadership',    keywords: ['CEO strategy','executive leadership','organisational transformation','board governance'] },
  { key: 'technology',  label: 'AI & Technology',          keywords: ['artificial intelligence','automation','digital transformation','LLM enterprise'] },
  { key: 'finance',     label: 'Finance & Investment',     keywords: ['private equity','M&A','venture capital','startup funding','valuation'] },
  { key: 'real_estate', label: 'Real Estate & FM',         keywords: ['GCC real estate','facilities management','service charge','giga-project','Vision 2030'] },
  { key: 'regulatory',  label: 'Regulation & Policy',      keywords: ['corporate governance','ESG regulation','data privacy','compliance'] },
  { key: 'market',      label: 'Market Intelligence',      keywords: ['market share','competitive landscape','industry consolidation','sector trends'] },
]

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode')

    if (mode === 'sectors') {
      return NextResponse.json({ sectors: EXEC_SECTORS })
    }

    // Fetch latest briefs + exec-priority feed topics
    const [briefsR, feedsR] = await Promise.all([
      supabase.from('sia_signal_briefs').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(10),
      supabase.from('user_feed_topics').select('id,label,topic,keywords,category,last_fetched,exec_priority')
        .eq('user_id', user.id).eq('is_active', true),
    ])

    return NextResponse.json({
      briefs:      briefsR.data ?? [],
      feed_topics: feedsR.data ?? [],
      sectors:     EXEC_SECTORS,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles').select('tenant_id,full_name,job_title,organisation').eq('id', user.id).single()
    const prof = profile as Record<string,unknown> | null
    if (!prof?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const body = await req.json()
    const { action } = body as { action: string }

    // ── Generate signal brief ────────────────────────────────
    if (action === 'generate_brief') {
      const { sectors, cadence = 'weekly' } = body as { sectors: string[]; cadence?: string }

      const selectedSectors = EXEC_SECTORS.filter(s => sectors.includes(s.key))
      if (!selectedSectors.length) return NextResponse.json({ error: 'No sectors selected' }, { status: 400 })

      const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

      const content = await callClaude(
        [{ role: 'user', content: `Generate a ${cadence} Strategic Intelligence Brief for ${(prof.full_name as string) ?? 'an executive'} (${(prof.job_title as string) ?? 'CEO'} at ${(prof.organisation as string) ?? 'their organisation'}).

Today: ${today}

SECTORS TO COVER:
${selectedSectors.map(s => `- ${s.label}: ${s.keywords.join(', ')}`).join('\n')}

Deliver a structured Signal Brief in this exact format:

## SIGNAL BRIEF — ${cadence.toUpperCase()} · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}

### EXECUTIVE SUMMARY
2-3 sentences: the single most important development across all sectors this ${cadence === 'weekly' ? 'week' : 'day'} and its strategic implication.

### SIGNALS BY SECTOR
For each sector, provide exactly 2 signals in this format:
**[SECTOR NAME]**
• [Signal title] — [2-sentence summary of what happened]. SO WHAT: [1-sentence strategic implication for a senior executive]
• [Second signal] — [same format]

### WHAT TO WATCH
3 developments to monitor over the next 2-4 weeks, with a clear reason why each matters.

### EXECUTIVE ACTION PROMPTS
2-3 specific questions this intelligence should prompt the reader to ask about their own organisation or strategy.

Be specific, current, and analytically sharp. Avoid generic statements. Each signal should have genuine executive relevance.` }],
        `You are SIA™ — the Strategic Intelligence Agent inside PIOS. You synthesise sector intelligence into sharp, executive-grade signal briefs. You write like a senior analyst, not a news aggregator. Every signal must have a clear "so what" for the executive reader. Today is ${today}.`,
        1400
      )

      // Persist to sia_signal_briefs
      const { data: brief } = await supabase.from('sia_signal_briefs').insert({
        user_id:   user.id,
        tenant_id: prof.tenant_id,
        title:     `${cadence.charAt(0).toUpperCase() + cadence.slice(1)} Signal Brief — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
        cadence,
        content,
        sectors:   sectors,
      }).select().single()

      return NextResponse.json({ content, brief_id: (brief as Record<string,unknown> | null)?.id })
    }

    // ── Toggle exec_priority on a feed topic ─────────────────
    if (action === 'toggle_exec_priority') {
      const { topic_id, exec_priority } = body as { topic_id: string; exec_priority: boolean }
      await supabase.from('user_feed_topics')
        .update({ exec_priority })
        .eq('id', topic_id).eq('user_id', user.id)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
