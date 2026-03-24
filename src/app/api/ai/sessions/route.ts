import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/ai/sessions              — list all sessions (title, id, domain, updated_at)
// GET  /api/ai/sessions?id=uuid      — fetch a single session with messages
// POST { action:'create', domain? }  — create new session
// POST { action:'save', id, messages, tokens_used? } — save messages
// POST { action:'title', id, messages } — auto-generate title from first exchange
// POST { action:'delete', id }       — delete session
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      const { data } = await supabase.from('ai_sessions').select('*').eq('id', id).eq('user_id', user.id).single()
      return NextResponse.json({ session: data })
    }

    const { data } = await supabase.from('ai_sessions')
      .select('id, title, domain, tokens_used, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(30)
    return NextResponse.json({ sessions: data ?? [] })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { action } = body

    if (action === 'create') {
      const { domain = 'general' } = body
      const { data } = await supabase.from('ai_sessions').insert({
        user_id: user.id,
        title: 'New conversation',
        domain,
        messages: [],
        tokens_used: 0,
      }).select('id').single()
      return NextResponse.json({ id: data?.id })
    }

    if (action === 'save') {
      const { id, messages, tokens_used } = body
      await supabase.from('ai_sessions').update({
        messages,
        tokens_used: tokens_used ?? 0,
        updated_at: new Date().toISOString(),
      }).eq('id', id).eq('user_id', user.id)
      return NextResponse.json({ saved: true })
    }

    if (action === 'title') {
      const { id, messages } = body
      if (!messages?.length) return NextResponse.json({ title: 'New conversation' })
      // Generate a short title from the first user message
      const firstUser = messages.find((m: unknown) => m.role === 'user')?.content ?? ''
      const raw = await callClaude(
        [{ role: 'user', content: `Generate a 4-6 word title for a conversation that starts with: "${firstUser.slice(0, 200)}". Return only the title, no quotes.` }],
        'Return only a short title. No quotes, no punctuation at the end.',
        50
      )
      const title = raw.trim().replace(/^["']|["']$/g, '').slice(0, 60)
      await supabase.from('ai_sessions').update({ title, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id)
      return NextResponse.json({ title })
    }

    if (action === 'delete') {
      await supabase.from('ai_sessions').delete().eq('id', body.id).eq('user_id', user.id)
      return NextResponse.json({ deleted: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
