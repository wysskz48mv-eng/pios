/**
 * GET /api/claude-context
 * Structured live context endpoint for Claude for Chrome.
 *
 * Returns a comprehensive snapshot of the user's current state
 * across all PIOS domains — optimised for Claude to understand
 * what needs attention without scraping the UI.
 *
 * Claude for Chrome uses this to:
 *   - Know what tasks are urgent/overdue
 *   - See today's calendar and meetings
 *   - Check thesis progress
 *   - Understand which emails need action
 *   - Get cross-platform KPIs (VeritasEdge, InvestiScript)
 *
 * Auth: Supabase session cookie (shared with browser session)
 * Rate: No strict limit but designed for periodic polling (not real-time)
 *
 * PIOS v3.0 | VeritasIQ Technologies Ltd
 */
import { NextResponse } from 'next/server'
import { createClient }  from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        {
          authenticated: false,
          message: 'Not signed in. Open PIOS and sign in first, then Claude for Chrome can access your context.',
          sign_in_url: '/auth/login',
        },
        {
          status: 401,
          headers: { 'Cache-Control': 'no-store' },
        }
      )
    }

    const today     = new Date().toISOString().slice(0, 10)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)
    const weekEnd    = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)

    // Parallel fetch all context data
    const [
      tasksRes,
      calRes,
      modulesRes,
      chaptersRes,
      emailRes,
      briefRes,
      expensesRes,
      notifsRes,
      meetingsRes,
      profileRes,
      accountsRes,
      receiptsRes,
    ] = await Promise.all([
      // Tasks — overdue + today + this week
      supabase.from('tasks').select('id,title,domain,priority,status,due_date,source')
        .eq('user_id', user.id)
        .not('status', 'in', '(done,cancelled)')
        .lte('due_date', weekEnd)
        .order('due_date', { ascending: true })
        .limit(30),

      // Calendar — today's events
      supabase.from('calendar_events').select('id,title,start_time,end_time,location,domain,google_meet_url,all_day')
        .eq('user_id', user.id)
        .gte('start_time', todayStart.toISOString())
        .lte('start_time', todayEnd.toISOString())
        .order('start_time'),

      // Academic modules in progress
      supabase.from('academic_modules').select('id,title,module_type,status,deadline,grade')
        .eq('user_id', user.id)
        .not('status', 'in', '(passed,failed)')
        .order('deadline', { ascending: true })
        .limit(10),

      // Thesis chapters
      supabase.from('thesis_chapters').select('id,chapter_num,title,status,word_count,target_words')
        .eq('user_id', user.id)
        .order('chapter_num'),

      // Email — unread/action-required count per inbox
      supabase.from('email_items').select('id,domain_tag,priority_score,action_required,inbox_label')
        .eq('user_id', user.id)
        .not('status', 'in', '(actioned,archived,ignored)')
        .not('action_required', 'is', null)
        .order('priority_score', { ascending: false })
        .limit(10),

      // Today's brief
      supabase.from('daily_briefs').select('content,created_at')
        .eq('user_id', user.id)
        .eq('brief_date', today)
        .maybeSingle(),

      // Expenses — this month summary
      supabase.from('expenses').select('amount,currency,category,domain,date')
        .eq('user_id', user.id)
        .gte('date', today.slice(0, 7) + '-01')
        .limit(100),

      // Notifications unread
      supabase.from('notifications').select('id,title,type,domain,created_at')
        .eq('user_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(5),

      // Recent meeting notes with pending action items
      supabase.from('meeting_notes').select('id,title,meeting_date,domain,status,tasks_created,ai_action_items')
        .eq('user_id', user.id)
        .eq('status', 'processed')
        .eq('tasks_created', false)
        .order('meeting_date', { ascending: false })
        .limit(5),

      // User profile
      supabase.from('user_profiles').select('full_name,university,programme_name,timezone')
        .eq('id', user.id)
        .single(),

      // Connected email accounts
      supabase.from('connected_email_accounts')
        .select('id,provider,context,label,email_address,is_primary,last_synced_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('is_primary', { ascending: false }),

      // Auto-captured receipts last 48h count
      supabase.from('email_items')
        .select('id,subject,sender_name,receipt_data,received_at', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('is_receipt', true)
        .gte('received_at', new Date(Date.now() - 48 * 3600000).toISOString())
        .limit(10),
    ])

    const tasks    = tasksRes.data    ?? []
    const calendar = calRes.data      ?? []
    const modules  = modulesRes.data  ?? []
    const chapters = chaptersRes.data ?? []
    const emails   = emailRes.data    ?? []
    const brief    = briefRes.data
    const expenses = expensesRes.data ?? []
    const notifs   = notifsRes.data   ?? []
    const meetings  = meetingsRes.data  ?? []
    const profile   = profileRes.data
    const accounts  = accountsRes.data  ?? []
    const receipts  = receiptsRes.data  ?? []
    const receiptsCount = receiptsRes.count ?? 0

    // ── Derived stats ─────────────────────────────────────────────────────────
    const overdueTasks = tasks.filter((t: any) => (t as Record<string,unknown>).due_date && (t as Record<string,unknown>).due_date as string < today)
    const todayTasks   = tasks.filter((t: any) => (t as Record<string,unknown>).due_date === today)
    const criticalTasks = tasks.filter((t: any) => (t as Record<string,unknown>).priority === 'critical')

    const totalWords   = chapters.reduce((s: number, c: unknown) => s + Number((c as Record<string,unknown>).word_count ?? 0), 0)
    const targetWords  = chapters.reduce((s: number, c: unknown) => s + Number((c as Record<string,unknown>).target_words ?? 8000), 0)
    const thesisProgress = targetWords > 0 ? Math.round((totalWords / targetWords) * 100) : 0

    const thisMonthSpend = expenses.reduce((s: number, e: unknown) => {
      // Sum GBP-equivalent (simplified — full multi-currency conversion not done here)
      const currencies: Record<string, number> = { GBP: 1, USD: 0.79, EUR: 0.86, AED: 0.21, SAR: 0.21 }
      return s + (parseFloat(String((e as Record<string,unknown>).amount ?? "0")) || 0) * (currencies[String((e as Record<string,unknown>).currency ?? "GBP")] ?? 1)
    }, 0)

    const pendingMeetingActions = meetings.reduce((s: number, m: unknown) =>
      s + (((m as any).ai_action_items as unknown[])?.length ?? 0), 0)

    // ── Response ──────────────────────────────────────────────────────────────
    return NextResponse.json(
      {
        // Identity
        authenticated: true,
        user: {
          name:         profile?.full_name ?? user.email?.split('@')[0] ?? 'User',
          email:        user.email,
          university:   profile?.university ?? null,
          programme:    profile?.programme_name ?? null,
          timezone:     profile?.timezone ?? 'Europe/London',
        },

        // Today snapshot
        today: {
          date:              today,
          day:               new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
          has_brief:         !!brief,
          brief_summary:     brief?.content ? String(brief.content ?? '').slice(0, 800) + (String(brief.content ?? '').length > 800 ? '…' : '') : null,
          brief_url:         '/api/brief',
        },

        // Attention required — what Claude should surface first
        attention: {
          overdue_tasks:         overdueTasks.length,
          critical_tasks:        criticalTasks.length,
          emails_needing_action: emails.length,
          unread_notifications:  notifs.length,
          meetings_with_pending_actions: meetings.length,
          pending_meeting_action_items:  pendingMeetingActions,
          email_accounts_connected:      accounts.length,
          auto_captured_receipts_48h:    receiptsCount,
        },

        // Tasks
        tasks: {
          overdue: overdueTasks.slice(0, 10).map((t: Record<string, unknown>) => ({
            id: (t as any)?.id, title: (t as any)?.title, domain: (t as any)?.domain,
            priority: (t as any)?.priority, due_date: (t as Record<string,unknown>).due_date as string,
          })),
          today: todayTasks.map((t: Record<string, unknown>) => ({
            id: (t as any)?.id, title: (t as any)?.title, domain: (t as any)?.domain, priority: (t as any)?.priority,
          })),
          critical: criticalTasks.filter((t: Record<string, unknown>) => !(t as Record<string,unknown>).due_date || String((t as Record<string,unknown>).due_date ?? "") >= today).slice(0, 5).map((t: Record<string, unknown>) => ({
            id: (t as any)?.id, title: (t as any)?.title, domain: (t as any)?.domain, due_date: (t as Record<string,unknown>).due_date as string,
          })),
          total_active: tasks.length,
        },

        // Calendar
        calendar: {
          today_events: calendar.map((e: Record<string, unknown>) => ({
            id: (e as Record<string,unknown>).id, title: (e as Record<string,unknown>).title, domain: (e as Record<string,unknown>).domain,
            start: (e as Record<string,unknown>).start_time, end: (e as Record<string,unknown>).end_time,
            location: (e as Record<string,unknown>).location, has_meet_link: !!(e as Record<string,unknown>).google_meet_url,
          })),
          event_count: calendar.length,
        },

        // Academic
        academic: {
          thesis: {
            total_words:    totalWords,
            target_words:   targetWords,
            progress_pct:   thesisProgress,
            chapters:       chapters.map((c: Record<string, unknown>) => ({
              num: (c as Record<string,unknown>).chapter_num, title: (c as Record<string,unknown>).title, status: (c as Record<string,unknown>).status,
              words: (c as Record<string,unknown>).word_count, target: (c as Record<string,unknown>).target_words,
            })),
          },
          active_modules: modules.slice(0, 5).map((m: Record<string, unknown>) => ({
            title: (m as Record<string,unknown>).title, type: (m as Record<string,unknown>).module_type, status: (m as Record<string,unknown>).status,
            deadline: (m as Record<string,unknown>).deadline,
          })),
        },

        // Email
        email: {
          action_required: emails.map((e: Record<string, unknown>) => ({
            subject: (e as Record<string,unknown>).action_required, domain: (e as Record<string,unknown>).domain_tag,
            priority: (e as Record<string,unknown>).priority_score, inbox: (e as Record<string,unknown>).inbox_label,
          })),
          total_needing_action: emails.length,
          sync_url: '/api/email/sync',
          accounts: accounts.map((a: Record<string, unknown>) => ({
            provider:    a.provider,
            context:     a.context,
            label:       a.label ?? a.email_address,
            is_primary:  a.is_primary,
            last_synced: a.last_synced_at,
          })),
          recent_receipts: receipts.slice(0, 5).map((r: Record<string, unknown>) => ({
            subject:  r.subject,
            vendor:   (r.receipt_data as Record<string,unknown>)?.vendor ?? r.sender_name,
            amount:   (r.receipt_data as Record<string,unknown>)?.amount,
            currency: (r.receipt_data as Record<string,unknown>)?.currency ?? 'GBP',
            date:     String(r.received_at ?? '').slice(0, 10),
          })),
        },

        // Meetings with pending actions
        meetings_pending: meetings.map((m: Record<string, unknown>) => ({
          id: (m as Record<string,unknown>).id, title: (m as Record<string,unknown>).title, date: (m as Record<string,unknown>).meeting_date, domain: (m as Record<string,unknown>).domain,
          action_item_count: (m.ai_action_items as unknown[])?.length ?? 0,
          promote_url: `POST /api/meetings { action: 'promote_tasks', id: '${(m as Record<string,unknown>).id}' }`,
        })),

        // Expenses
        expenses: {
          this_month_gbp_equiv: Math.round(thisMonthSpend),
          entry_count:          expenses.length,
          log_expense_url:      'POST /api/expenses { action: "create", description, amount, currency, category, domain, date }',
          ai_categorise_url:    'POST /api/expenses { action: "ai_categorise", description, amount, currency }',
        },

        // Notifications
        notifications: notifs.map((n: Record<string, unknown>) => ({
          title: (n as any)?.title, type: (n as any)?.type, domain: n.domain, created: n.created_at,
        })),

        // Quick action guide for Claude
        quick_actions: {
          create_task:      'POST /api/tasks { title, domain, priority, due_date, description }',
          sync_email:       'POST /api/email/sync',
          log_expense:      'POST /api/expenses { action: "create", description, amount, currency, category, domain, date }',
          create_meeting:   'POST /api/meetings { title, raw_transcript, auto_process: true, domain, meeting_type }',
          get_brief:        'GET /api/brief',
          mark_task_done:   'PATCH /api/tasks { id, status: "done" }',
        },

        // Metadata
        _meta: {
          generated_at:  new Date().toISOString(),
          platform:      'PIOS v3.0',
          llms_txt:      '/llms.txt',
          docs:          'https://pios.veritasiq.io/platform/setup'
        ,  llms_txt_url:  'https://pios.veritasiq.io/llms.txt',
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Content-Type':  'application/json',
          'X-PIOS-Version': '3.0',
        },
      }
    )

  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message ?? 'Internal server error', authenticated: false },
      { status: 500 }
    )
  }
}
