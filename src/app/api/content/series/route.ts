import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET  /api/content/series — get user's primary series (or all)
 * POST /api/content/series — create a new series
 * VeritasIQ Technologies Ltd
 */

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ series: null })

    const url = new URL(req.url)
    const all = url.searchParams.get('all') === '1'

    if (all) {
      const { data } = await supabase
        .from('content_series')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      return NextResponse.json({ series_list: data ?? [] })
    }

    // Default: return the primary/first active series
    const { data } = await supabase
      .from('content_series')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    return NextResponse.json({ series: data ?? null })
  } catch {
    return NextResponse.json({ series: null })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const body = await req.json()
    const {
      title, slug, platform, platform_url, studio_url,
      genre, total_episodes, current_episode, word_target,
      bible, style_guide, platform_series_id,
    } = body

    if (!title || !slug) return NextResponse.json({ error: 'title and slug required' }, { status: 400 })

    const { data, error } = await supabase
      .from('content_series')
      .insert({
        user_id:           user.id,
        title,
        slug,
        platform:          platform ?? 'pocket_fm',
        platform_url:      platform_url ?? null,
        platform_series_id: platform_series_id ?? null,
        studio_url:        studio_url ?? null,
        genre:             genre ?? null,
        status:            'active',
        total_episodes:    total_episodes ?? 0,
        published_episodes: 0,
        current_episode:   current_episode ?? 1,
        word_target:       word_target ?? 1375,
        bible:             bible ?? null,
        style_guide:       style_guide ?? null,
        created_at:        new Date().toISOString(),
        updated_at:        new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ series: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const url = new URL(req.url)
    const id  = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await req.json()
    const { data, error } = await supabase
      .from('content_series')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', user.id)
      .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ series: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
