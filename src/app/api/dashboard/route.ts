/**
 * GET /api/dashboard
 * Uses Promise.allSettled — a missing table never crashes the response.
 * PIOS v2.2 | Sprint 28 | VeritasIQ Technologies Ltd
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function val<T>(r: PromiseSettledResult<any>): T {
  return (r.status === 'fulfilled' ? (r.value?.data ?? null) : null) as T
}
function cnt(r: PromiseSettledResult<any>): number {
  return r.status === 'fulfilled' ? (r.value?.count ?? 0) : 0
}

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const today      = new Date().toISOString().slice(0, 10)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)
    const ago48h     = new Date(Date.now() - 48 * 3600000).toISOString()
    const ago7d      = new Date(Date.now() -  7 * 86400000).toISOString().slice(0, 10)

    const [
      tasksR, projectsR, modulesR, briefR, tenantR,
      calR, invoicesR, emailsR, transfersR,
      meetingsR, receiptsR, accountsR, chaptersR,
    ] = await Promise.allSettled([
      supabase.from('tasks')
        .select('id,title,domain,priority,due_date,status,source')
        .eq('user_id', user.id)
        .not('status', 'in', '("done","cancelled")')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(20),

      supabase.from('projects')
        .select('id,title,domain,status,progress,colour,deadline')
        .eq('user_id', user.id).eq('status', 'active')
        .order('created_at', { ascending: false }).limit(6),

      supabase.from('academic_modules')
        .select('id,title,status,deadline,module_type')
        .eq('user_id', user.id)
        .not('status', 'in', '("passed","failed")')
        .order('deadline', { ascending: true, nullsFirst: false }).limit(6),

      supabase.from('daily_briefs')
        .select('content,generated_by,ai_model')
        .eq('user_id', user.id).eq('brief_date', today).single(),

      supabase.from('tenants')
        .select('name,plan,plan_status,subscription_status,ai_credits_used,ai_credits_limit,trial_ends_at')
        .limit(1).single(),

      supabase.from('calendar_events')
        .select('id,title,start_time,end_time,location,domain,all_day,google_meet_url,platform')
        .eq('user_id', user.id)
        .gte('start_time', todayStart.toISOString())
        .lte('start_time', todayEnd.toISOString())
        .order('start_time'),

      supabase.from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('status', 'pending'),

      supabase.from('email_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('action_required', 'is', null)
        .in('status', ['unprocessed', 'triaged']),

      supabase.from('transfer_queue')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('status', 'queued'),

      supabase.from('meeting_notes')
        .select('id,title,meeting_date,meeting_type,domain,status,tasks_created,ai_summary')
        .eq('user_id', user.id)
        .gte('meeting_date', ago7d)
        .order('meeting_date', { ascending: false }).limit(5),

      supabase.from('email_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('is_receipt', true)
        .gte('received_at', ago48h),

      supabase.from('connected_email_accounts')
        .select('id,email_address,provider,context,label,is_primary,last_synced_at')
        .eq('user_id', user.id).eq('is_active', true)
        .order('is_primary', { ascending: false }),

      supabase.from('thesis_chapters')
        .select('id,chapter_num,title,status,word_count,target_words')
        .eq('user_id', user.id).order('chapter_num'),
    ])

    const tasks    = val<any[]>(tasksR)    ?? []
    const chapters = val<any[]>(chaptersR) ?? []
    const meetings = val<any[]>(meetingsR) ?? []
    const accounts = val<any[]>(accountsR) ?? []
    const calendar = val<any[]>(calR)      ?? []

    const overdueTasks  = tasks.filter((t: any) => t.due_date && t.due_date < today)
    const dueTodayTasks = tasks.filter((t: any) => t.due_date === today)
    const upcomingTasks = tasks.filter((t: any) => !t.due_date || t.due_date > today)
    const totalWords    = chapters.reduce((s: number, c: any) => s + (c.word_count   ?? 0), 0)
    const targetWords   = chapters.reduce((s: number, c: any) => s + (c.target_words ?? 8000), 0)
    const pendingMeetingActions = meetings.filter((m: any) => m.status === 'processed' && !m.tasks_created).length
    const tenantData = tenantR.status === 'fulfilled' ? (tenantR.value?.data ?? null) : null
    const briefContent = briefR.status === 'fulfilled' ? ((briefR.value?.data as any)?.content ?? null) : null

    return NextResponse.json({
      tasks: { overdue: overdueTasks, due_today: dueTodayTasks, upcoming: upcomingTasks.slice(0, 8), total_open: tasks.length },
      projects:       val<any[]>(projectsR) ?? [],
      modules:        val<any[]>(modulesR)  ?? [],
      brief:          briefContent,
      tenant:         tenantData,
      calendar:       { today: calendar, count: calendar.length },
      counts: {
        pending_invoices:        cnt(invoicesR),
        action_emails:           cnt(emailsR),
        queued_transfers:        cnt(transfersR),
        receipts_48h:            cnt(receiptsR),
        email_accounts:          accounts.length,
        pending_meeting_actions: pendingMeetingActions,
      },
      meetings:       { recent: meetings, pending_actions: pendingMeetingActions },
      email_accounts: accounts,
      thesis: {
        chapters,
        total_words:   totalWords,
        target_words:  targetWords,
        pct_complete:  targetWords > 0 ? Math.round(totalWords / targetWords * 100) : 0,
        chapters_done: chapters.filter((c: any) => ['submitted','passed','draft_complete'].includes(c.status)).length,
      },
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
