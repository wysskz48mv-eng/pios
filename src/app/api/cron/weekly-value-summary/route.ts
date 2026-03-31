import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callClaude } from '@/lib/ai/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const weekEnd = now.toISOString().split('T')[0]
  const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]

  // Get all users with activity in the last 7 days (from tasks table as activity proxy)
  const { data: activeUserRows } = await supabase
    .from('tasks')
    .select('user_id')
    .gte('updated_at', new Date(Date.now() - 7 * 86400000).toISOString())

  if (!activeUserRows?.length) {
    return NextResponse.json({ ok: true, processed: 0, message: 'No active users this week' })
  }

  const userIds = Array.from(new Set(activeUserRows.map(r => r.user_id)))
  let processed = 0

  for (const userId of userIds) {
    // Tasks completed this week
    const { count: tasksCompleted } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'done')
      .gte('updated_at', new Date(Date.now() - 7 * 86400000).toISOString())

    // Emails triaged this week
    const { count: emailsTriaged } = await supabase
      .from('email_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('triaged', true)
      .gte('triaged_at', new Date(Date.now() - 7 * 86400000).toISOString())

    // Decisions resolved this week
    const { count: decisionsMade } = await supabase
      .from('decisions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'resolved')
      .gte('resolved_at', new Date(Date.now() - 7 * 86400000).toISOString())

    // Coaching sessions this week
    const { count: coachingSessions } = await supabase
      .from('coaching_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())

    // Academic milestones this week
    const { count: academicMilestones } = await supabase
      .from('milestones')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', new Date(Date.now() - 7 * 86400000).toISOString())

    // AI actions (token usage rows as proxy)
    const { count: aiActionsUsed } = await supabase
      .from('ai_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())

    const tc = tasksCompleted ?? 0
    const et = emailsTriaged ?? 0
    const dm = decisionsMade ?? 0
    const cs = coachingSessions ?? 0
    const am = academicMilestones ?? 0
    const ai = aiActionsUsed ?? 0

    // Generate AI narrative (3 sentences)
    let narrative = ''
    try {
      narrative = await callClaude(
        [{ role: 'user', content: `Weekly activity summary for one PIOS user:\n- Tasks completed: ${tc}\n- Emails triaged: ${et}\n- Decisions resolved: ${dm}\n- Coaching sessions: ${cs}\n- Academic milestones: ${am}\n- AI actions used: ${ai}\n\nWrite exactly 3 sentences: (1) highlight the most impactful achievement, (2) note a pattern or trend, (3) suggest one focus for next week. Be encouraging and specific.` }],
        'You are a productivity analyst writing a weekly value summary. Be concise and direct.',
        200,
        'haiku'
      )
    } catch {
      narrative = `This week you completed ${tc} tasks and triaged ${et} emails. ${dm > 0 ? `You also resolved ${dm} decisions.` : 'Keep building momentum.'} Focus on your highest-priority items next week.`
    }

    // Upsert into weekly_summaries
    await supabase.from('weekly_summaries').upsert({
      user_id: userId,
      week_start: weekStart,
      week_end: weekEnd,
      tasks_completed: tc,
      emails_triaged: et,
      decisions_made: dm,
      coaching_sessions: cs,
      ai_actions_used: ai,
      narrative,
      created_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_start' })

    processed++
  }

  return NextResponse.json({ ok: true, processed, week_start: weekStart, week_end: weekEnd })
}
