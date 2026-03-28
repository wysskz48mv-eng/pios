import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET  /api/content/episodes        — list episodes
 * POST /api/content/episodes        — create episode
 * GET  /api/content/episodes/[id]   — get single episode with full text
 * PATCH /api/content/episodes/[id]  — update episode (manuscript, status, etc.)
 * VeritasIQ Technologies Ltd · Content Pipeline
 */

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const url    = new URL(req.url)
  const limit  = parseInt(url.searchParams.get('limit') ?? '50')
  const status = url.searchParams.get('status')
  const from   = url.searchParams.get('from')
  const to     = url.searchParams.get('to')

  let q = supabase
    .from('content_episodes')
    .select('id,episode_number,title,status,word_count,review_score,consistency_score,manuscript_matches_published,last_compared_at,approved_at,published_at,updated_at,cliffhanger,episode_arc')
    .eq('user_id', user.id)
    .order('episode_number', { ascending: true })
    .limit(limit)

  if (status) q = q.eq('status', status)
  if (from)   q = q.gte('episode_number', parseInt(from))
  if (to)     q = q.lte('episode_number', parseInt(to))

  const { data: episodes, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ episodes: episodes ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const {
    series_id, episode_number, title,
    manuscript_text, platform_chapter_id, platform_episode_id,
    episode_arc, cliffhanger, key_events, characters_featured,
  } = body

  if (!episode_number || !title) return NextResponse.json({ error: 'episode_number and title required' }, { status: 400 })

  const wordCount = manuscript_text ? manuscript_text.split(/\s+/).filter(Boolean).length : 0

  const { data, error } = await supabase
    .from('content_episodes')
    .insert({
      user_id:             user.id,
      series_id:           series_id ?? null,
      episode_number,
      title,
      manuscript_text:     manuscript_text ?? null,
      status:              manuscript_text ? 'manuscript_ready' : 'draft',
      word_count:          wordCount,
      platform_chapter_id: platform_chapter_id ?? null,
      platform_episode_id: platform_episode_id ?? null,
      episode_arc:         episode_arc ?? null,
      cliffhanger:         cliffhanger ?? null,
      key_events:          key_events ?? [],
      characters_featured: characters_featured ?? [],
      drafted_at:          manuscript_text ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ episode: data }, { status: 201 })
}
