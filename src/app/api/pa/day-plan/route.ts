import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/pa/day-plan
 * NemoClaw™ Day Planning Engine
 *
 * Generates a structured daily plan from:
 *   - Today's calendar events (gaps = available time)
 *   - Open tasks (prioritised by OKR relevance, deadline, priority)
 *   - User energy preferences (deep work AM by default)
 *   - Total available hours vs total task hours
 *
 * Returns:
 *   - time_blocks: [{start, end, task_id?, title, type}]
 *   - deferred: tasks that won't fit today
 *   - capacity_gap: hours short or spare
 *
 * VeritasIQ Technologies Ltd · PIOS Sprint K+1
 */

export const dynamic     = 'force-dynamic'
export const maxDuration = 20

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin  = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  // Load today's context
  const [taskRes, okrRes, calRes, prefRes] = await Promise.allSettled([
    admin.from('tasks').select('id,title,priority,due_date,estimated_hours,domain').eq('user_id', user.id).neq('status','done').order('priority',{ascending:false}).limit(15),
    admin.from('executive_okrs').select('id,objective,key_results').eq('user_id', user.id).eq('status','active'),
    // Calendar events would come from Google Calendar API in production
    // For now return empty — user pastes schedule
    Promise.resolve({ data: [] }),
    admin.from('user_profiles').select('deep_work_hours,work_start_hour,work_end_hour').eq('user_id', user.id).single(),
  ])

  const tasks = taskRes.status === 'fulfilled' ? taskRes.value.data ?? [] : []
  const okrs  = okrRes.status  === 'fulfilled' ? okrRes.value.data  ?? [] : []
  const prefs = prefRes.status === 'fulfilled' ? prefRes.value.data  ?? {} : {}

  const workStart = (prefs as {work_start_hour?:number}).work_start_hour ?? 8
  const workEnd   = (prefs as {work_end_hour?:number}).work_end_hour   ?? 18
  const totalHours = workEnd - workStart

  const body = await req.json().catch(() => ({}))
  const calendarEvents: {title:string;start:string;end:string}[] = body.calendar_events ?? []

  // Build the planning prompt
  const prompt = `You are a professional day planner. Create an optimal daily plan for today (${today}).

WORK HOURS: ${workStart}:00 - ${workEnd}:00 (${totalHours} hours available)

CALENDAR EVENTS (already booked):
${calendarEvents.length > 0 ? calendarEvents.map(e => `${e.start}-${e.end}: ${e.title}`).join('\n') : 'None provided — assume no meetings.'}

TASKS TO SCHEDULE (prioritise in this order: overdue > high priority > OKR-linked > medium):
${(tasks as {title:string;priority:string;due_date?:string;estimated_hours?:number;domain?:string}[]).map((t, i) => 
  `${i+1}. [${t.priority}] ${t.title}${t.due_date ? ` — due ${t.due_date === today ? 'TODAY' : t.due_date < today ? 'OVERDUE' : t.due_date}` : ''}${t.estimated_hours ? ` (~${t.estimated_hours}h)` : ' (~1h)'}`
).join('\n')}

ACTIVE OKRs (use to prioritise which tasks get scheduled first):
${(okrs as {objective:string}[]).map(o => `- ${o.objective}`).join('\n')}

PLANNING PRINCIPLES:
- Reserve 09:00-11:00 for deep work unless calendar conflicts
- Group similar tasks (admin block, creative block)
- Include a lunch break 12:30-13:30
- Don't overschedule — leave 20% buffer
- Tasks that don't fit: include in "deferred" list with reason

Return JSON only:
{
  "time_blocks": [
    {"start": "09:00", "end": "11:00", "title": "Deep work: [task name]", "type": "deep_work", "task_index": 1},
    {"start": "11:00", "end": "12:00", "title": "Task name", "type": "task", "task_index": 2},
    {"start": "12:30", "end": "13:30", "title": "Lunch", "type": "break"}
  ],
  "deferred": [{"task_index": 3, "reason": "No time today — suggest tomorrow morning"}],
  "planned_hours": 7.5,
  "summary": "One sentence on the day's focus"
}`

  const msg = await client.messages.create({
    model:      'claude-sonnet-4-5-20251001',
    max_tokens: 1000,
    messages:   [{ role: 'user', content: prompt }],
  })

  let plan: {
    time_blocks:   {start:string;end:string;title:string;type:string;task_index?:number}[]
    deferred:      {task_index:number;reason:string}[]
    planned_hours: number
    summary:       string
  } | null = null

  try {
    const text   = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
    const clean  = text.replace(/```json|```/g, '').trim()
    plan         = JSON.parse(clean)
  } catch {
    return NextResponse.json({ error: 'Plan generation failed' }, { status: 500 })
  }

  // Enrich time blocks with task IDs
  const tasksArray = tasks as {id:string;title:string}[]
  const enriched = plan!.time_blocks.map(block => ({
    ...block,
    task_id: block.task_index != null ? tasksArray[block.task_index - 1]?.id : undefined,
  }))

  const deferredTasks = (plan!.deferred ?? []).map(d => ({
    task_id: tasksArray[d.task_index - 1]?.id,
    title:   tasksArray[d.task_index - 1]?.title,
    reason:  d.reason,
  }))

  // Store day plan
  await admin.from('day_plans').upsert({
    user_id:        user.id,
    plan_date:      today,
    time_blocks:    enriched,
    capacity_hours: totalHours,
    planned_hours:  plan!.planned_hours,
    deferred_task_ids: deferredTasks.map((d: {task_id?:string}) => d.task_id).filter(Boolean),
    accepted:       false,
    created_at:     new Date().toISOString(),
  }, { onConflict: 'user_id,plan_date' })

  return NextResponse.json({
    time_blocks:   enriched,
    deferred:      deferredTasks,
    planned_hours: plan!.planned_hours,
    capacity_hours: totalHours,
    summary:       plan!.summary,
    plan_date:     today,
  })
}
