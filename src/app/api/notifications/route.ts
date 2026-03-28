import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET  /api/notifications         — list notifications, unread count
 * POST /api/notifications         — create notification (internal use)
 * PATCH /api/notifications?id=xxx — mark as read
 * DELETE /api/notifications?all=1 — mark all as read
 *
 * VeritasIQ Technologies Ltd · PIOS
 */

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ notifications: [], unread: 0 })

    const url   = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') ?? '20')
    const unreadOnly = url.searchParams.get('unread') === '1'

    let q = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unreadOnly) q = q.eq('read', false)

    const { data: notifications, error } = await q

    // Graceful: notifications table may not exist yet
    if (error?.code === '42P01') {
      return NextResponse.json({ notifications: [], unread: 0, table_missing: true })
    }

    const unread = (notifications ?? []).filter(n => !n.read).length

    return NextResponse.json({
      notifications: notifications ?? [],
      unread,
    })
  } catch {
    return NextResponse.json({ notifications: [], unread: 0 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const body = await req.json()
    const { title, body: msgBody, type = 'info', action_url } = body

    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id:    user.id,
        title,
        body:       msgBody ?? null,
        type,
        action_url: action_url ?? null,
        read:       false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      // Table may not exist — non-fatal
      return NextResponse.json({ ok: true, created: false, note: error.message })
    }

    return NextResponse.json({ ok: true, notification: data }, { status: 201 })
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
    const all = url.searchParams.get('all') === '1'

    if (all) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)
      return NextResponse.json({ ok: true, marked_all_read: true })
    }

    if (!id) return NextResponse.json({ error: 'id or all=1 required' }, { status: 400 })

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', user.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
