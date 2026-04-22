import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const params = await context.params
    const sessionId = params.id
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? '100')

    const { data: session } = await supabase
      .from('ai_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data } = await supabase
      .from('ai_messages')
      .select('id,session_id,role,content,metadata,created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(Math.min(200, Math.max(1, limit)))

    return NextResponse.json({ messages: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const params = await context.params
    const sessionId = params.id
    const body = await request.json()

    const { data } = await supabase
      .from('ai_messages')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        role: body.role,
        content: String(body.content ?? ''),
        metadata: body.metadata ?? null,
      })
      .select('id,session_id,role,content,metadata,created_at')
      .single()

    const { data: session } = await supabase
      .from('ai_sessions')
      .select('message_count')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    await supabase
      .from('ai_sessions')
      .update({
        message_count: Number(session?.message_count ?? 0) + 1,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', user.id)

    return NextResponse.json({ message: data })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
