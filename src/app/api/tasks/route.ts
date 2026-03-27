import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'
import { callClaude } from '@/lib/ai/client'
import { auditLog } from '@/lib/security-middleware'

export const runtime = 'nodejs'

const VALID_STATUSES   = ['todo','in_progress','blocked','done','cancelled']
const VALID_PRIORITIES = ['critical','high','medium','low']
const VALID_DOMAINS    = ['academic','fm_consulting','saas','business','personal']
const VALID_SOURCES    = ['manual','email','ai','calendar']

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const domain   = searchParams.get('domain')
    const status   = searchParams.get('status')
    const source   = searchParams.get('source')
    const overdue  = searchParams.get('overdue')
    const priority = searchParams.get('priority')
    const project  = searchParams.get('project_id')
    const today    = new Date().toISOString().slice(0, 10)

    let q = supabase.from('tasks').select('*').eq('user_id', user.id).neq('status', 'cancelled').order('due_date', { ascending: true, nullsFirst: false })
    if (domain   && domain   !== 'all') q = q.eq('domain',   domain)
    if (source   && source   !== 'all') q = q.eq('source',   source)
    if (priority && priority !== 'all') q = q.eq('priority', priority)
    if (project)                        q = q.eq('project_id', project)
    if (overdue  === '1')               q = q.lt('due_date', today)
    if (status && status !== 'all')    q = q.eq('status', status)
    else if (!status)                  q = q.not('status', 'in', '(done,cancelled)')
    const { data } = await q
    return NextResponse.json({ tasks: data ?? [] })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal server error' }, { status: 500 })
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
      const system = `You are PIOS AI helping Douglas Masuku, Group CEO of VeritasIQ Technologies Ltd and DBA candidate at University of Portsmouth. Analyse his task list and return a prioritised order with reasoning.

Return ONLY valid JSON:
{
  "prioritised": [
    { "id": "task-uuid", "rank": 1, "urgency": "critical|high|medium|low", "reasoning": "One sentence why this is rank N today" }
  ],
  "focus_recommendation": "One paragraph: what Douglas should focus on first today and why, considering cross-domain pressures",
  "blocked_risks": ["Any tasks that might block others if not done soon"]
}`
      const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      const taskList = tasks.map((t: Record<string, unknown>) => `ID:${t.id} | ${t.title} | ${t.domain} | ${t.priority} | due:${t.due_date ?? 'none'} | status:${t.status}`).join('\n')
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
      if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })
      return NextResponse.json({ task: data })
    } catch (err: unknown) {
      return NextResponse.json({ error: (err as Error).message ?? 'Internal server error' }, { status: 500 })
    }

  } catch (err: unknown) {
    console.error('[PIOS] tasks POST:', (err as Error).message)
    return NextResponse.json({ error: (err as Error).message ?? 'Internal server error' }, { status: 500 })
  }}

export async function PATCH(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // Allowlist + validate
    const ALLOWED = ['title','description','domain','priority','status','due_date',
                     'duration_mins','notes','project_id','source','completed_at']
    const safe: Record<string,unknown> = { updated_at: new Date().toISOString() }
    for (const k of (ALLOWED as any[])) { if (k in body) safe[k] = body[k] }

    if ((safe as any).status   && !VALID_STATUSES.includes((safe as any).status))
      return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    if ((safe as any).priority && !VALID_PRIORITIES.includes((safe as any).priority))
      return NextResponse.json({ error: 'invalid priority' }, { status: 400 })
    if ((safe as any).domain   && !VALID_DOMAINS.includes((safe as any).domain))
      return NextResponse.json({ error: 'invalid domain' }, { status: 400 })
    if ((safe as any).source   && !VALID_SOURCES.includes((safe as any).source))
      return NextResponse.json({ error: 'invalid source' }, { status: 400 })

    // Auto-set completed_at
    if ((safe as any).status === 'done' && !(safe as any).completed_at) {
      (safe as any).completed_at = new Date().toISOString()
      const { data: t } = await supabase.from('tasks').select('title,domain').eq('id', id).maybeSingle()
      if (t) await createNotification({ userId: user.id, title: `✓ Task done: ${t.title}`, type: 'success', domain: t.domain, actionUrl: '/platform/tasks' })
    }
    if ((safe as any).status && (safe as any).status !== 'done') (safe as any).completed_at = null

    // Clamp duration
    if ((safe as any).duration_mins !== undefined) (safe as any).duration_mins = Math.max(5, Math.min(480, parseInt((safe as any).duration_mins) || 30))

    const { data, error } = await supabase.from('tasks')
      .update(safe).eq('id', id).eq('user_id', user.id).select().single()
    if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })
    return NextResponse.json({ task: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal server error' }, { status: 500 })
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
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal server error' }, { status: 500 })
  }
}
