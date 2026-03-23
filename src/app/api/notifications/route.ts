/**
 * GET  /api/notifications  — fetch unread notifications for current user
 * POST /api/notifications  — { action:'mark_read', ids?:string[] } mark as read
 *
 * PIOS v2.2 | VeritasIQ Technologies Ltd
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase
      .from('notifications')
      .select('id,title,body,type,domain,action_url,read,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    const notifications = data ?? []
    return NextResponse.json({
      notifications,
      unread: notifications.filter(n => !n.read).length,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    if (body.action === 'mark_read') {
      const q = supabase.from('notifications').update({ read: true }).eq('user_id', user.id)
      if (body.ids?.length) {
        await q.in('id', body.ids)
      } else {
        await q.eq('read', false)
      }
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'create') {
      const { title, type = 'info', domain, action_url, body: msgBody } = body
      if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
      await supabase.from('notifications').insert({
        user_id:    user.id,
        title,
        body:       msgBody ?? null,
        type,
        domain:     domain ?? null,
        action_url: action_url ?? null,
        read:       false,
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
