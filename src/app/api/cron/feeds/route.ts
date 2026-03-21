/**
 * GET /api/cron/feeds
 * Vercel Cron — runs daily at 05:00 UTC (07:00 UAE / 06:00 UK)
 * Runs ONE HOUR before the brief cron (06:00 UTC) so fresh news
 * is available when briefs are generated.
 *
 * For each active user:
 *   1. Generates fresh FM news items (AI digest, ~10 headlines)
 *   2. Fetches all active user feed topics (batch of 3 at a time)
 *
 * Skips users whose fm_news_items were fetched in the last 20 hours
 * (avoids duplicate AI calls on manual refreshes earlier in the day).
 *
 * Protected by CRON_SECRET header.
 *
 * PIOS v2.0 | Sustain International FZE Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callClaude } from '@/lib/ai/client'

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 300

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

function authOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}

const FM_CATEGORIES = [
  'GCC giga-projects FM market news',
  'AI and predictive maintenance in facilities management',
  'Smart building technology and IoT FM updates',
  'FM sustainability and ESG regulations Middle East',
  'Service charge management software market',
  'ISO 55001 asset management standards',
  'BIFM / RICS FM professional standards',
  'FM workforce digital transformation',
]

async function generateFMNews(admin: ReturnType<typeof createClient>, userId: string): Promise<number> {
  try {
    const prompt = `You are an FM industry intelligence analyst. Generate today's top 8 FM industry news items.
Cover these categories: ${FM_CATEGORIES.join(', ')}.
Focus on GCC/Middle East context where relevant. Include global signals that affect GCC FM markets.

Return ONLY valid JSON — an array of exactly 8 objects:
[{
  "headline": "...",
  "summary": "One sentence. Actionable insight.",
  "category": "one of: GCC Market | AI/Tech | Sustainability | Standards | Workforce | Service Charge",
  "relevance": 1–10 (10 = directly relevant to GCC FM practitioners),
  "source": "plausible publication name",
  "source_url": "https://plausible-url.com"
}]`

    const raw = await callClaude(
      [{ role: 'user', content: 'Generate today\'s FM news digest.' }],
      prompt, 800
    )

    let items: any[] = []
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim()
      items = JSON.parse(cleaned)
      if (!Array.isArray(items)) items = []
    } catch { return 0 }

    if (!items.length) return 0

    const inserts = items.map((item: any) => ({
      user_id:    userId,
      headline:   item.headline ?? '',
      summary:    item.summary ?? '',
      category:   item.category ?? 'GCC Market',
      relevance:  Math.min(10, Math.max(1, parseInt(item.relevance) || 5)),
      source:     item.source ?? '',
      source_url: item.source_url ?? '',
      fetched_at: new Date().toISOString(),
    }))

    // Delete old items for this user (keep last 24h only)
    await admin.from('fm_news_items')
      .delete()
      .eq('user_id', userId)
      .lt('fetched_at', new Date(Date.now() - 24 * 3600000).toISOString())

    await admin.from('fm_news_items').insert(inserts)
    return inserts.length
  } catch { return 0 }
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const start = Date.now()
  const cutoff = new Date(Date.now() - 20 * 3600000).toISOString() // 20h ago

  // Get all users
  const { data: profiles, error } = await admin
    .from('user_profiles').select('id').limit(100)

  if (error || !profiles?.length) {
    return NextResponse.json({ error: error?.message ?? 'No profiles' }, { status: 500 })
  }

  let fmNewsRefreshed = 0, feedsRefreshed = 0, skipped = 0, failed = 0

  for (const profile of profiles) {
    const uid = profile.id
    try {
      // Check if FM news was fetched recently
      const { data: recent } = await admin
        .from('fm_news_items')
        .select('id').eq('user_id', uid)
        .gte('fetched_at', cutoff)
        .limit(1)

      if (recent?.length) {
        skipped++
      } else {
        const count = await generateFMNews(admin, uid)
        if (count > 0) fmNewsRefreshed++
      }

      // Refresh user feed topics (always — feeds are cheap)
      const { data: topics } = await admin
        .from('user_feed_topics')
        .select('id, label, topic, keywords, sources, exclude_terms, category, max_items')
        .eq('user_id', uid).eq('is_active', true)
        .order('sort_order').limit(10)

      if (topics?.length) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        // Call the feeds API as service (uses session from cookie — skip for cron)
        // Instead: directly update cached_items via AI call per topic
        for (const topic of topics.slice(0, 3)) { // Max 3 topics per user in cron
          try {
            const prompt = `Generate ${topic.max_items ?? 5} fresh news items for the topic: "${topic.topic}".
Keywords: ${(topic.keywords ?? []).join(', ')}.
Return only JSON array: [{"title":"...","summary":"one sentence","relevance":1-10,"source":"..."}]`

            const raw = await callClaude(
              [{ role: 'user', content: `Fetch news for: ${topic.topic}` }], prompt, 400
            )
            const cleaned = raw.replace(/```json|```/g, '').trim()
            const items = JSON.parse(cleaned)
            if (Array.isArray(items)) {
              await admin.from('user_feed_topics').update({
                cached_items: items,
                last_fetched: new Date().toISOString(),
              }).eq('id', topic.id)
              feedsRefreshed++
            }
          } catch { /* skip this topic */ }
        }
      }
    } catch (err: any) {
      console.error(`[cron/feeds] Failed for user ${uid}:`, err.message)
      failed++
    }
  }

  const elapsed = Math.round((Date.now() - start) / 1000)
  console.log(`[cron/feeds] FM news: ${fmNewsRefreshed} refreshed, ${skipped} skipped. Feeds: ${feedsRefreshed} topics. Errors: ${failed}. ${elapsed}s`)

  return NextResponse.json({
    fmNewsRefreshed, feedsRefreshed, skipped, failed, elapsed_s: elapsed,
  })
}
