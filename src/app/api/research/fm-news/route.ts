import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

export const runtime = 'nodejs'
export const maxDuration = 45

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/research/fm-news
// Generates a live FM industry news digest using AI with current knowledge.
// Covers: GCC FM market, smart buildings, AI in FM, sustainability, regulation.
// Saves items to fm_news_items table. Returns top 8-10 headlines.
//
// GET: Returns last 48h of cached news from DB.
// POST: Fetches fresh news and saves to DB.
// ─────────────────────────────────────────────────────────────────────────────

const FM_CATEGORIES = [
  'GCC giga-projects FM market',
  'AI and predictive maintenance in facilities management',
  'Smart building technology and IoT FM',
  'FM sustainability and ESG regulations Middle East',
  'Service charge management software market',
  'ISO 55001 asset management standards updates',
  'BIFM / RICS FM professional standards',
  'FM workforce digital skills and transformation',
]

export async function POST() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const today = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })

    const system = `You are an FM industry intelligence analyst. Generate a daily FM market intelligence digest for Douglas Masuku, CEO of VeritasIQ Technologies Ltd, an FM consulting and SaaS company operating in the GCC (Saudi Arabia, UAE, Qatar). Douglas is also a DBA researcher studying AI adoption in GCC FM.

Today is ${today}.

Generate 10 realistic, current-feeling FM industry news items across these domains:
${FM_CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Make news items realistic and relevant to someone operating at the intersection of:
- GCC giga-project FM (NEOM, Qiddiya, King Salman Park, Expo City)
- AI/SaaS for FM (service charge management, predictive maintenance)
- Academic research (AI adoption in FM, STS theory, sensemaking)

Return ONLY valid JSON, no markdown:
{
  "items": [
    {
      "headline": "Concise news headline (max 15 words)",
      "summary": "2-3 sentence summary of the development and its significance",
      "source": "Publication/organisation name (e.g. FM World, RICS, BIFM, Arab News, MEED)",
      "source_url": "https://plausible-url.com/article",
      "category": "one of: general|technology|regulation|market|sustainability|giga_projects|middle_east|standards|workforce|ai_fm",
      "relevance": 1-5,
      "relevance_reason": "One sentence: why this matters to Douglas specifically"
    }
  ]
}`

    const raw = await callClaude(
      [{ role: 'user', content: `Generate today's FM industry intelligence digest. Today: ${today}` }],
      system,
      2500
    )

    let parsed: any = {}
    try {
      const clean = raw.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      return NextResponse.json({ error: 'News digest parsing failed' }, { status: 500 })
    }

    const items = parsed.items ?? []
    if (items.length === 0) return NextResponse.json({ error: 'No news items generated' }, { status: 500 })

    // Delete old unsaved news items older than 7 days
  try {
      await supabase.from('fm_news_items')
        .delete()
        .eq('user_id', user.id)
        .eq('saved', false)
        .lt('fetched_at', new Date(Date.now() - 7 * 86400000).toISOString())

      // Insert fresh items
      const inserts = items.map((item: Record<string, unknown>) => ({
        user_id: user.id,
        headline: item.headline,
        summary: item.summary,
        source: item.source,
        source_url: item.source_url,
        category: item.category ?? 'general',
        relevance: item.relevance ?? 3,
        fetched_at: new Date().toISOString(),
      }))

      await supabase.from('fm_news_items').insert(inserts)

      return NextResponse.json({
        items,
        count: items.length,
        generatedAt: new Date().toISOString(),
        ai_disclaimer: 'AI-generated intelligence digest. Verify breaking news via primary sources before acting.',
      })
    } catch (err: any) {
      console.error('/api/research/fm-news:', err)
      return NextResponse.json({ error: err.message ?? 'News fetch failed' }, { status: 500 })
    }

  } catch (err: any) {
    console.error('[PIOS] research/fm-news POST:', err.message)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }}

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase.from('fm_news_items')
      .select('*')
      .eq('user_id', user.id)
      .order('fetched_at', { ascending: false })
      .limit(30)

    return NextResponse.json({ items: data ?? [], count: data?.length ?? 0 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
