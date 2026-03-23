import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

export const runtime = 'nodejs'
export const maxDuration = 45

// ─────────────────────────────────────────────────────────────────────────────
// /api/feeds
//
// GET                              — list all user feed topics + settings
// POST { action:'fetch', id }      — fetch fresh content for one feed topic
// POST { action:'fetch_all' }      — fetch fresh content for all active topics
// POST { action:'add', topic }     — add a new feed topic
// POST { action:'update', id, ... }— update topic config
// POST { action:'delete', id }     — delete a feed topic
// POST { action:'reorder', ids[] } — save new sort order
// POST { action:'settings', ... }  — update global feed settings
// ─────────────────────────────────────────────────────────────────────────────

async function fetchFeedContent(topic: unknown): Promise<any[]> {
  const keywordsStr = topic.keywords?.length ? `Key terms: ${topic.keywords.join(', ')}.` : ''
  const sourcesStr  = topic.sources?.length  ? `Prefer these sources: ${topic.sources.join(', ')}.` : ''
  const excludeStr  = topic.exclude_terms?.length ? `Exclude: ${topic.exclude_terms.join(', ')}.` : ''

  const today = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })

  const system = `You are an intelligent news aggregator. Generate a current, realistic news digest on the specified topic. Today is ${today}.

Return ONLY valid JSON — an array of news items, nothing else:
[
  {
    "headline": "Concise headline, max 15 words",
    "summary": "2-3 sentence summary covering the key development and why it matters",
    "source": "Publication or organisation name",
    "source_url": "https://plausible-realistic-url.com/article-slug",
    "published_relative": "2 hours ago / Yesterday / 3 days ago",
    "category_tag": "Short tag e.g. Market / Policy / Research / Product",
    "relevance": 1-5,
    "insight": "One sentence: specific actionable insight or implication for an FM/SaaS/DBA professional in the GCC"
  }
]`

  const userPrompt = `Topic: "${topic.topic}"
${keywordsStr}
${sourcesStr}
${excludeStr}
Return ${topic.max_items ?? 8} news items, most relevant and recent first.
Context: User is a GCC FM consultant, DBA researcher (AI in FM), and SaaS founder (VeritasEdge™, InvestiScript, PIOS).`

  const raw = await callClaude(
    [{ role: 'user', content: userPrompt }],
    system,
    2000
  )

  try {
    const clean = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [topicsR, settingsR] = await Promise.all([
      supabase.from('user_feed_topics')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order'),
      supabase.from('user_feed_settings')
        .select('*')
        .eq('user_id', user.id)
        .single(),
    ])

    return NextResponse.json({
      topics: topicsR.data ?? [],
      settings: settingsR.data ?? {
        command_layout: 'grid',
        brief_include_feeds: true,
        brief_feed_count: 3,
        auto_refresh: true,
        show_relevance: true,
      },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { action } = body

    // ── Fetch single topic ───────────────────────────────────────────────────
    if (action === 'fetch') {
      const { id } = body
      const { data: topic } = await supabase.from('user_feed_topics')
        .select('*').eq('id', id).eq('user_id', user.id).single()
      if (!topic) return NextResponse.json({ error: 'Feed not found' }, { status: 404 })

      const items = await fetchFeedContent(topic)

      await supabase.from('user_feed_topics').update({
        cached_items: items,
        last_fetched: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', id)

      return NextResponse.json({ items, count: items.length, feedId: id })
    }

    // ── Fetch all active topics ───────────────────────────────────────────────
    if (action === 'fetch_all') {
      const { data: topics } = await supabase.from('user_feed_topics')
        .select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order')
      if (!topics?.length) return NextResponse.json({ results: [] })

      // Fetch all in parallel (max 3 at a time to avoid rate limits)
      const results: unknown[]$1
      const batchSize = 3
      for (let i = 0; i < topics.length; i += batchSize) {
        const batch = topics.slice(i, i + batchSize)
        const fetched = await Promise.all(batch.map(async (t) => {
          const items = await fetchFeedContent(t)
          await supabase.from('user_feed_topics').update({
            cached_items: items,
            last_fetched: new Date().toISOString(),
          }).eq('id', t.id)
          return { feedId: t.id, label: t.label, items, count: items.length }
        }))
        results.push(...fetched)
      }

      return NextResponse.json({ results, totalFeeds: topics.length })
    }

    // ── Add new topic ─────────────────────────────────────────────────────────
    if (action === 'add') {
      const { topic } = body
      if (!topic?.label?.trim() || !topic?.topic?.trim()) {
        return NextResponse.json({ error: 'Label and topic are required' }, { status: 400 })
      }
      // Get current max sort_order
      const { data: existing } = await supabase.from('user_feed_topics')
        .select('sort_order').eq('user_id', user.id).order('sort_order', { ascending: false }).limit(1)
      const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

      const { data } = await supabase.from('user_feed_topics').insert({
        user_id: user.id,
        label: topic.label,
        description: topic.description ?? '',
        emoji: topic.emoji ?? '📰',
        topic: topic.topic,
        keywords: topic.keywords ?? [],
        sources: topic.sources ?? [],
        exclude_terms: topic.exclude_terms ?? [],
        category: topic.category ?? 'industry',
        layout: topic.layout ?? 'cards',
        refresh_freq: topic.refresh_freq ?? 'daily',
        max_items: topic.max_items ?? 8,
        sort_order: nextOrder,
      }).select('id').single()

      return NextResponse.json({ added: true, id: data?.id })
    }

    // ── Update topic ──────────────────────────────────────────────────────────
    if (action === 'update') {
      const { id, ...updates } = body
      delete updates.action
      delete updates.user_id
      delete updates.created_at
      await supabase.from('user_feed_topics').update({
        ...updates,
        updated_at: new Date().toISOString(),
      }).eq('id', id).eq('user_id', user.id)
      return NextResponse.json({ updated: true })
    }

    // ── Delete topic ──────────────────────────────────────────────────────────
    if (action === 'delete') {
      await supabase.from('user_feed_topics').delete().eq('id', body.id).eq('user_id', user.id)
      return NextResponse.json({ deleted: true })
    }

    // ── Reorder topics ────────────────────────────────────────────────────────
    if (action === 'reorder') {
      const { ids } = body // array of ids in new order
      await Promise.all(ids.map((id: string, i: number) =>
        supabase.from('user_feed_topics').update({ sort_order: i }).eq('id', id).eq('user_id', user.id)
      ))
      return NextResponse.json({ reordered: true })
    }

    // ── Update global settings ────────────────────────────────────────────────
    if (action === 'settings') {
      const { action: _a, ...settings } = body
      await supabase.from('user_feed_settings').upsert({
        user_id: user.id,
        ...settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      return NextResponse.json({ updated: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    console.error('/api/feeds:', err)
    return NextResponse.json({ error: err.message ?? 'Request failed' }, { status: 500 })
  }
}
