import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET  /api/content/episodes/[id]   — full episode including manuscript + published text
 * PATCH /api/content/episodes/[id]  — update episode fields
 * VeritasIQ Technologies Ltd · PIOS Content Pipeline
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { data, error } = await supabase
      .from('content_episodes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const body = await req.json()

    // Auto-calculate word count if manuscript_text provided
    if (body.manuscript_text) {
      body.word_count = body.manuscript_text
        .split(/\s+/)
        .filter(Boolean).length
    }

    // Detect mismatch between manuscript and published
    if (body.manuscript_text) {
      const { data: current } = await supabase
        .from('content_episodes')
        .select('published_text')
        .eq('id', id)
        .single()

      if (current?.published_text) {
        body.manuscript_matches_published =
          body.manuscript_text.trim() === current.published_text.trim()
      }
    }

    const { data, error } = await supabase
      .from('content_episodes')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
