/**
 * GET /api/dashboard
 * Single-fetch aggregator for the PIOS Command Centre dashboard.
 * Replaces 9 direct supabase.from() calls in the dashboard page.
 *
 * Returns all dashboard context in one round-trip:
 *   tasks      — open tasks (overdue, due today, upcoming)
 *   projects   — active projects
 *   modules    — academic modules in progress
 *   brief      — today's morning brief (cached)
 *   tenant     — plan, AI credits
 *   calendar   — today's events
 *   counts     — pending invoices, action emails, queued transfers
 *   meetings   — recent meeting notes (last 7 days)
 *   receipts   — auto-captured receipts count (last 48h)
 *   email_accounts — connected inbox count
 *
 * PIOS v2.2 | VeritasIQ Technologies Ltd
 */
import { NextResponse }    from 'next/server'
import { createClient }    from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const today        = new Date().toISOString().slice(0, 10)
    const todayStart   = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd     = new Date(); todayEnd.setHours(23, 59, 59, 999)
    const ago48h       = new Date(Date.now() - 48 * 3600000).toISOString()
    const ago7d        = new Date(Date.now() - 7  * 86400000).toISOString().slice(0, 10)

    // Fire all queries in parallel
    const [
      tasksR, projectsR, modulesR, briefR, tenantR,
      calR, invoicesR, emailsR, transfersR,
      meetingsR, receiptsR, accountsR, chaptersR,
    ] = await Promise.all([
      // Open tasks
      supabase.from('tasks')
        .select('id,title,domain,priority,due_date,status,source')
        .eq('user_id', user.id)
        .not('status', 'in', '("done","cancelled")')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(20),

      // Active projects
      supabase.from('projects')
        .select('id,title,domain,status,progress,colour,deadline')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(6),

      // Academic modules
      supabase.from('academic_modules')
        .select('id,title,status,deadline,module_type')
        .eq('user_id', user.id)
        .not('status', 'in', '("passed","failed")')
        .order('deadline', { ascending: true, nullsFirst: false })
        .limit(6),

      // Today's brief
      supabase.from('daily_briefs')
        .select('content,generated_by,ai_model')
        .eq('user_id', user.id)
        .eq('brief_date', today)
        .single(),

      // Tenant plan + AI credits
      supabase.from('tenants')
        .select('name,plan,plan_status,ai_credits_used,ai_credits_limit,trial_ends_at')
        .limit(1)
        .single(),

      // Today's calendar events
      supabase.from('calendar_events')
        .select('id,title,start_time,end_time,location,domain,all_day,google_meet_url,platform')
        .eq('user_id', user.id)
        .gte('start_time', todayStart.toISOString())
        .lte('start_time', todayEnd.toISOString())
        .order('start_time'),

      // Pending invoice count
      supabase.from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending'),

      // Action-required emails count
      supabase.from('email_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('action_required', 'is', null)
        .in('status', ['unprocessed', 'triaged']),

      // Queued transfers count
      supabase.from('transfer_queue')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'queued'),

      // Recent meeting notes (last 7 days)
      supabase.from('meeting_notes')
        .select('id,title,meeting_date,meeting_type,domain,status,tasks_created,ai_summary')
        .eq('user_id', user.id)
        .gte('meeting_date', ago7d)
        .order('meeting_date', { ascending: false })
        .limit(5),

      // Auto-captured receipts last 48h
      supabase.from('email_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_receipt', true)
        .gte('received_at', ago48h),

      // Connected email accounts count
      supabase.from('connected_email_accounts')
        .select('id,email_address,provider,context,label,is_primary,last_synced_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('is_primary', { ascending: false }),

      // Thesis chapters
      supabase.from('thesis_chapters')
        .select('id,chapter_num,title,status,word_count,target_words')
        .eq('user_id', user.id)
        .order('chapter_num'),
    ])

    const tasks    = tasksR.data    ?? []
    const chapters = chaptersR.data ?? []

    // Derived counts
    const overdueTasks  = tasks.filter(t => t.due_date && t.due_date < today)
    const dueTodayTasks = tasks.filter(t => t.due_date === today)
    const upcomingTasks = tasks.filter(t => !t.due_date || t.due_date > today)
    const totalWords    = chapters.reduce((s, c) => s + (c.word_count  ?? 0), 0)
    const targetWords   = chapters.reduce((s, c) => s + (c.target_words ?? 8000), 0)

    // Pending meeting action items (processed but not yet promoted)
    const pendingMeetingActions = (meetingsR.data ?? [])
      .filter((m: any) => m.status === 'processed' && !m.tasks_created)
      .length

    return NextResponse.json({
      tasks: {
        overdue:  overdueTasks,
        due_today: dueTodayTasks,
        upcoming:  upcomingTasks.slice(0, 8),
        total_open: tasks.length,
      },
      projects: projectsR.data ?? [],
      modules:  modulesR.data  ?? [],
      brief:    briefR.data?.content ?? null,

      tenant: tenantR.data ?? null,

      calendar: {
        today: calR.data ?? [],
        count: (calR.data ?? []).length,
      },

      counts: {
        pending_invoices:  invoicesR.count  ?? 0,
        action_emails:     emailsR.count    ?? 0,
        queued_transfers:  transfersR.count ?? 0,
        receipts_48h:      receiptsR.count  ?? 0,
        email_accounts:    (accountsR.data  ?? []).length,
        pending_meeting_actions: pendingMeetingActions,
      },

      meetings: {
        recent: meetingsR.data ?? [],
        pending_actions: pendingMeetingActions,
      },

      email_accounts: accountsR.data ?? [],

      thesis: {
        chapters,
        total_words:    totalWords,
        target_words:   targetWords,
        pct_complete:   targetWords > 0 ? Math.round(totalWords / targetWords * 100) : 0,
        chapters_done:  chapters.filter(c => ['submitted','passed','draft_complete'].includes(c.status)).length,
      },
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
