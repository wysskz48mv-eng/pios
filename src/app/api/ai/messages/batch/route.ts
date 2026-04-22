import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const sessionId = String(body.sessionId ?? '')
    const messages = Array.isArray(body.messages) ? body.messages : []

    if (!sessionId || messages.length === 0) {
      return NextResponse.json({ error: 'sessionId and messages are required' }, { status: 400 })
    }

    const rows = messages.map((m: Record<string, unknown>) => ({
      session_id: sessionId,
      user_id: user.id,
      role: String(m.role ?? 'user'),
      content: String(m.content ?? ''),
      metadata: (m.metadata ?? null) as Record<string, unknown> | null,
    }))

    const { data, error } = await supabase
      .from('ai_messages')
      .insert(rows)
      .select('id,session_id,role,content,metadata,created_at')

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const { data: session } = await supabase
      .from('ai_sessions')
      .select('message_count')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    await supabase
      .from('ai_sessions')
      .update({
        message_count: Number(session?.message_count ?? 0) + rows.length,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', user.id)

    return NextResponse.json({ inserted: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
