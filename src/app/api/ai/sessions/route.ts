import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      const { data: session } = await supabase
        .from('ai_sessions')
        .select('id,title,domain_mode,message_count,last_message_at,updated_at,created_at')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      const { data: messageRows } = await supabase
        .from('ai_messages')
        .select('id,session_id,role,content,metadata,created_at')
        .eq('session_id', id)
        .order('created_at', { ascending: true })

      return NextResponse.json({ session: { ...session, messages: messageRows ?? [] } })
    }

    const { data } = await supabase
      .from('ai_sessions')
      .select('id,title,domain_mode,message_count,last_message_at,updated_at,created_at')
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(50)

    return NextResponse.json({ sessions: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { action } = body

    if (action === 'create') {
      const domainMode = body.domain_mode ?? body.domain ?? 'general'
      const { data } = await supabase
        .from('ai_sessions')
        .insert({
          user_id: user.id,
          title: 'New conversation',
          domain_mode: domainMode,
          domain: domainMode,
          message_count: 0,
        })
        .select('id')
        .single()

      return NextResponse.json({ id: data?.id })
    }

    if (action === 'title') {
      const { id, messages } = body
      if (!messages?.length) return NextResponse.json({ title: 'New conversation' })

      const firstUser = messages.find((m: { role: string }) => m.role === 'user')?.content ?? ''
      const raw = await callClaude(
        [{ role: 'user', content: `Generate a 4-6 word title for: "${String(firstUser).slice(0, 200)}". Return only title.` }],
        'Return only a short title with no punctuation.',
        50
      )

      const title = raw.trim().replace(/^['"]|['"]$/g, '').slice(0, 60)
      await supabase.from('ai_sessions').update({ title, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id)
      return NextResponse.json({ title })
    }

    if (action === 'save') {
      const { id, messages } = body
      if (!id || !Array.isArray(messages)) return NextResponse.json({ error: 'id and messages are required' }, { status: 400 })

      await supabase.from('ai_messages').delete().eq('session_id', id)

      if (messages.length > 0) {
        await supabase.from('ai_messages').insert(
          messages.map((m: Record<string, unknown>) => ({
            session_id: id,
            user_id: user.id,
            role: m.role,
            content: String(m.content ?? ''),
            metadata: (m.metadata ?? null) as Record<string, unknown> | null,
          }))
        )
      }

      await supabase
        .from('ai_sessions')
        .update({
          message_count: messages.length,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)

      return NextResponse.json({ saved: true })
    }

    if (action === 'delete') {
      await supabase.from('ai_sessions').delete().eq('id', body.id).eq('user_id', user.id)
      return NextResponse.json({ deleted: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
