import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'
import { callClaude } from '@/lib/ai/client'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const status = searchParams.get('status')
    let q = supabase.from('tasks').select('*').eq('user_id', user.id).neq('status', 'cancelled').order('due_date', { ascending: true, nullsFirst: false })
    if (domain && domain !== 'all') q = q.eq('domain', domain)
    if (status && status !== 'all') q = q.eq('status', status)
    const { data } = await q
    return NextResponse.json({ tasks: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()

    // AI prioritise action
    if (body.action === 'ai_prioritise') {
      const { tasks } = body
      const system = `You are PIOS AI helping Douglas Masuku, Group CEO of Sustain International FZE Ltd and DBA candidate at University of Portsmouth. Analyse his task list and return a prioritised order with reasoning.

Return ONLY valid JSON:
{
  "prioritised": [
    { "id": "task-uuid", "rank": 1, "urgency": "critical|high|medium|low", "reasoning": "One sentence why this is rank N today" }
  ],
  "focus_recommendation": "One paragraph: what Douglas should focus on first today and why, considering cross-domain pressures",
  "blocked_risks": ["Any tasks that might block others if not done soon"]
}`
      const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      const taskList = tasks.map((t: any) => `ID:${t.id} | ${t.title} | ${t.domain} | ${t.priority} | due:${t.due_date ?? 'none'} | status:${t.status}`).join('\n')
      const raw = await callClaude(
        [{ role: 'user', content: `Today is ${today}. Here are my tasks:\n${taskList}\n\nPrioritise these for today.` }],
        system, 1200
      )
      let parsed: any = {}
      try { parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()) } catch { parsed = { focus_recommendation: raw } }
      return NextResponse.json(parsed)
    }

    // Normal create
  try {
      const { data, error } = await supabase.from('tasks').insert({
        ...body,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ task: data })
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
    }

  } catch (err: any) {
    console.error('[PIOS] tasks POST:', err.message)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }}

export async function PATCH(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, ...updates } = await request.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    if (updates.status === 'done' && !updates.completed_at) {
      updates.completed_at = new Date().toISOString()
      // Notification on task completion
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: t } = await supabase.from('tasks').select('title,domain').eq('id', id).maybeSingle()
        if (t) await createNotification({ userId: user.id, title: `✓ Task done: ${t.title}`, type: 'success', domain: t.domain, actionUrl: '/platform/tasks' })
      }
    }
    if (updates.status && updates.status !== 'done') updates.completed_at = null
    updates.updated_at = new Date().toISOString()
    const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).eq('user_id', user.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ task: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await supabase.from('tasks').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id)
    return NextResponse.json({ cancelled: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
