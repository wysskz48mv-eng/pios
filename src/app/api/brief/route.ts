import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { createNotification } from '@/lib/notifications'
import { sendEmail, morningBriefHtml, morningBriefText } from '@/lib/email/resend'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

export const runtime    = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/brief[?force=1]
 * Generates (or force-refreshes) the morning brief for the current user.
 *
 * Default: returns cached brief if one already exists for today.
 * ?force=1: regenerates fresh regardless of cache. No email sent on refresh.
 *
 * Context gathered:
 *   - Overdue tasks (flagged prominently), due-today, upcoming
 *   - Expense claims awaiting reimbursement
 *   - Queued payroll transfers
 *   - Academic modules + thesis chapter word velocity
 *   - Active projects with progress
 *   - Unread notifications
 *   - FM news (last 24h)
 *   - Imminent CFP deadlines
 *   - Live VeritasEdge / InvestiScript metrics
 *
 * PIOS v2.2 | VeritasIQ Technologies Ltd
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const force = new URL(req.url).searchParams.get('force') === '1'
    const today = new Date().toISOString().slice(0, 10)
    const now   = new Date()

    // Return cached unless forced
    if (!force) {
      const { data: cached } = await supabase
        .from('daily_briefs').select('content').eq('user_id', user.id).eq('brief_date', today).single()
      if (cached?.content) return NextResponse.json({ content: cached.content, brief_date: today, cached: true })
    }

    // Gather all context in parallel
    const [tasksR, modulesR, projectsR, notifsR, chaptersR, fmNewsR, cfpR, expensesR, payrollR, meetingsR, pendingActionsR, receiptsR] = await Promise.all([
      supabase.from('tasks').select('title,domain,priority,due_date,status')
        .eq('user_id', user.id).not('status', 'in', '("done","cancelled")')
        .order('due_date', { ascending: true }).limit(15),
      supabase.from('academic_modules').select('title,status,deadline,module_type')
        .eq('user_id', user.id).not('status', 'in', '("passed","failed")').limit(6),
      supabase.from('projects').select('title,domain,status,progress')
        .eq('user_id', user.id).eq('status', 'active').limit(6),
      supabase.from('notifications').select('title,type,domain')
        .eq('user_id', user.id).eq('read', false)
        .order('created_at', { ascending: false }).limit(5),
      supabase.from('thesis_chapters').select('title,chapter_num,status,word_count,target_words')
        .eq('user_id', user.id).order('chapter_num').limit(6),
      supabase.from('fm_news_items').select('headline,category,relevance,summary')
        .eq('user_id', user.id)
        .gte('fetched_at', new Date(Date.now() - 86400000).toISOString())
        .order('relevance', { ascending: false }).limit(5),
      supabase.from('paper_calls').select('title,journal_name,deadline,relevance_score')
        .eq('user_id', user.id).in('status', ['new','considering','planning'])
        .gte('deadline', today)
        .lte('deadline', new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10))
        .order('deadline').limit(3),
      supabase.from('expenses').select('description,amount,currency,date')
        .eq('user_id', user.id).eq('billable', true)
        .is('reimbursed_at', null)
        .order('date', { ascending: false }).limit(5),
      supabase.from('transfer_queue').select('description,amount_gbp,status')
        .eq('user_id', user.id).eq('status', 'queued').limit(3),
      // Meetings from last 2 days + today
      supabase.from('meeting_notes').select('title,meeting_date,meeting_type,domain,status,ai_summary,tasks_created')
        .eq('user_id', user.id)
        .gte('meeting_date', new Date(Date.now() - 2 * 86400000).toISOString().slice(0,10))
        .order('meeting_date', { ascending: false }).limit(5),
      // Processed meetings with action items not yet promoted to tasks
      supabase.from('meeting_notes').select('title,meeting_date,ai_action_items')
        .eq('user_id', user.id).eq('status', 'processed').eq('tasks_created', false)
        .order('meeting_date', { ascending: false }).limit(3),
      // Auto-captured receipts/invoices from email (last 48h)
      supabase.from('email_items').select('subject,sender_name,receipt_data,received_at')
        .eq('user_id', user.id).eq('is_receipt', true)
        .gte('received_at', new Date(Date.now() - 48 * 3600000).toISOString())
        .order('received_at', { ascending: false }).limit(5),
    ])

    const tasks     = tasksR.data ?? []
    const overdue   = tasks.filter(t => t.due_date && t.due_date < today)
    const dueToday  = tasks.filter(t => t.due_date === today)
    const upcoming  = tasks.filter(t => !t.due_date || t.due_date > today)

    // Thesis velocity
    const chapters    = chaptersR.data ?? []
    const totalWords  = chapters.reduce((s, c) => s + (c.word_count ?? 0), 0)
    const targetWords = chapters.reduce((s, c) => s + (c.target_words ?? 8000), 0)
    const nearestDl   = (modulesR.data ?? []).map(m => m.deadline).filter(Boolean).sort()[0]
    const daysLeft    = nearestDl ? Math.max(1, Math.round((new Date(nearestDl).getTime() - now.getTime()) / 86400000)) : null
    const wordsPerDay = daysLeft ? Math.ceil(Math.max(0, targetWords - totalWords) / daysLeft) : null

    const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short' })

    const ctx = [
      `DATE: ${now.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}`,

      overdue.length > 0
        ? `OVERDUE TASKS — REQUIRES IMMEDIATE ATTENTION (${overdue.length}):\n` +
          overdue.map(t => `- [${(t.priority ?? '').toUpperCase()}] ${t.title} (${t.domain}) — was due ${fmt(t.due_date)}`).join('\n')
        : 'OVERDUE TASKS: none',

      dueToday.length > 0
        ? `DUE TODAY (${dueToday.length}):\n` + dueToday.map(t => `- [${t.priority}] ${t.title} (${t.domain})`).join('\n')
        : 'DUE TODAY: none',

      upcoming.length > 0
        ? `UPCOMING (${upcoming.length} open):\n` + upcoming.slice(0,6).map(t =>
            `- [${t.priority}] ${t.title} (${t.domain}) — ${t.due_date ? fmt(t.due_date) : 'no date'}`).join('\n')
        : '',

      `ACADEMIC MODULES:\n` + ((modulesR.data ?? []).map(m =>
        `- ${m.title} [${m.status}] — ${m.deadline ? fmt(m.deadline) : 'TBD'}`).join('\n') || 'none'),

      chapters.length > 0
        ? `THESIS: ${totalWords.toLocaleString()}/${targetWords.toLocaleString()} words (${Math.round(totalWords/Math.max(targetWords,1)*100)}%)` +
          (wordsPerDay ? ` · needs ${wordsPerDay.toLocaleString()} words/day` : '') + '\n' +
          chapters.map(c => `- Ch${c.chapter_num} ${c.title}: ${c.word_count ?? 0}/${c.target_words ?? 8000} words [${c.status}]`).join('\n')
        : '',

      (projectsR.data ?? []).length > 0
        ? `ACTIVE PROJECTS:\n` + (projectsR.data ?? []).map(p => `- ${p.title} (${p.domain}) — ${p.progress ?? 0}% done`).join('\n')
        : '',

      (notifsR.data ?? []).length > 0
        ? `UNREAD ALERTS (${notifsR.data?.length}):\n` + (notifsR.data ?? []).map(n => `- [${n.type.toUpperCase()}] ${n.title}`).join('\n')
        : 'UNREAD ALERTS: none',

      (expensesR.data ?? []).length > 0
        ? `UNBILLED EXPENSES (${expensesR.data?.length}):\n` + (expensesR.data ?? []).map(e => `- ${e.currency} ${e.amount} — ${e.description} (${fmt(e.date)})`).join('\n')
        : '',

      (payrollR.data ?? []).length > 0
        ? `QUEUED TRANSFERS (${payrollR.data?.length}):\n` + (payrollR.data ?? []).map(t => `- GBP ${t.amount_gbp} — ${t.description}`).join('\n')
        : '',

      (fmNewsR.data ?? []).length > 0
        ? `FM INTELLIGENCE (last 24h):\n` + (fmNewsR.data ?? []).map((n: Record<string, unknown>) => `- [${(n.category ?? '').toUpperCase()}] ${n.headline}`).join('\n')
        : 'FM INTELLIGENCE: no fresh signals',

      (cfpR.data ?? []).length > 0
        ? `PUBLICATION DEADLINES:\n` + (cfpR.data ?? []).map((c: Record<string, unknown>) => `- "${c.title}" (${c.journal_name ?? 'journal'}) — ${c.deadline}`).join('\n')
        : '',

      // Meetings context (Otter.ai integration)
      (meetingsR.data ?? []).length > 0
        ? `RECENT MEETINGS (${meetingsR.data?.length}):\n` +
          (meetingsR.data ?? []).map((m: Record<string, unknown>) =>
            `- [${m.meeting_type.toUpperCase()}] ${m.title} (${m.meeting_date}) — ${m.status}${m.ai_summary ? ': ' + m.ai_summary.slice(0, 120) + '…' : ''}${m.tasks_created ? ' [tasks created]' : ''}`
          ).join('\n')
        : '',

      (pendingActionsR.data ?? []).length > 0
        ? `MEETING ACTION ITEMS AWAITING TASK PROMOTION (${pendingActionsR.data?.length} meetings):\n` +
          (pendingActionsR.data ?? []).flatMap((m: unknown) =>
            ((m.ai_action_items ?? []) as unknown[]).slice(0,3).map((a: Record<string, unknown>) =>
              `- [${(a.priority ?? 'medium').toUpperCase()}] ${a.action} — from "${m.title}" (${m.meeting_date}). Go to /platform/meetings to promote.`
            )
          ).join('\n')
        : '',

      // Auto-captured receipts (WellyBox integration)
      (receiptsR.data ?? []).length > 0
        ? `AUTO-CAPTURED RECEIPTS/INVOICES (last 48h — ${receiptsR.data?.length}):\n` +
          (receiptsR.data ?? []).map((r: Record<string, unknown>) => {
            const rd = r.receipt_data
            return rd
              ? `- ${rd.vendor ?? r.sender_name ?? 'Unknown'}: ${rd.currency ?? 'GBP'} ${rd.amount ?? '?'} — ${r.subject} (${rd.date ?? 'today'})`
              : `- ${r.subject} from ${r.sender_name}`
          }).join('\n')
        : '',
    ].filter(Boolean).join('\n\n')

    // Live platform metrics (non-blocking)
    let liveCtx = ''
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const [seRes, isRes, ghRes] = await Promise.allSettled([
        fetch(`${appUrl}/api/live/veritasedge`).then(r => r.json()),
        fetch(`${appUrl}/api/live/investiscript`).then(r => r.json()),
        fetch(`${appUrl}/api/live/github`).then(r => r.json()),
      ])
      if (seRes.status === 'fulfilled' && seRes.value?.connected) {
        const s = seRes.value.snapshot
        liveCtx += `\nVERITASEDGE: ${s?.organisations?.total ?? 0} tenants, ${s?.assets?.total ?? 0} assets`
      }
      if (isRes.status === 'fulfilled' && isRes.value?.connected) {
        const i = isRes.value.snapshot
        liveCtx += `\nINVESTISCRIPT: ${i?.organisations?.total ?? 0} newsrooms, ${i?.topics?.total ?? 0} investigations`
      }
      if (ghRes.status === 'fulfilled' && ghRes.value?.connected && ghRes.value.repos) {
        const commits = Object.values(ghRes.value.repos as Record<string,any>)
          .map(r => r.commits?.[0] ? `${r.label}: ${(r.commits[0].message ?? '').slice(0,60)}` : null)
          .filter(Boolean).slice(0,3).join(' | ')
        if (commits) liveCtx += `\nLATEST COMMITS: ${commits}`
      }
    } catch { /* never block */ }

    const system = `You are the PIOS AI Companion for Douglas Masuku — founder CEO of VeritasIQ Technologies Ltd, DBA candidate at University of Portsmouth, FM consultant building VeritasEdge™ (service charge SaaS), InvestiScript (investigative journalism AI), and PIOS.

Generate his morning brief. Be direct and action-oriented. No pleasantries.

Rules:
- If overdue tasks exist, lead with them — they are the #1 priority
- Flag if thesis writing pace is dangerously behind
- If meeting action items are awaiting task promotion, call them out explicitly — direct to /platform/meetings
- If auto-captured receipts/invoices are present, mention total and suggest reviewing Expenses
- Identify cross-domain conflicts (academic vs business deadlines)
- Name the 2-3 items requiring his personal decision or action today
- Close with one actionable FM/platform signal if present
- Max 350 words. Plain prose, no bullet points, no lists.`

    const content = await callClaude(
      [{ role: 'user', content: `Generate my morning brief.\n\n${ctx}${liveCtx ? '\n\nPLATFORM STATUS:' + liveCtx : ''}` }],
      system, 700
    )

    // Upsert — always overwrites stale brief on refresh
    await supabase.from('daily_briefs').upsert({
      user_id:      user.id,
      brief_date:   today,
      content,
      ai_model:     'claude-sonnet-4-20250514',
      generated_by: force ? 'user_refresh' : 'user',
    }, { onConflict: 'user_id,brief_date' })

    // Email on first generate only (not on refresh)
    if (!force) {
      const { data: profile } = await supabase
        .from('user_profiles').select('billing_email, google_email, full_name').eq('id', user.id).single()
      const userEmail = (profile as Record<string,unknown>)?.billing_email ?? (profile as Record<string,unknown>)?.google_email
      const userName  = (profile as Record<string,unknown>)?.full_name ?? 'there'
      if (userEmail) {
        sendEmail({
          to:      userEmail,
          subject: `Your PIOS Brief — ${new Date(today).toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })}`,
          html:    morningBriefHtml(content, today, userName),
          text:    morningBriefText(content, today, userName),
        }).catch(() => {})
      }
    }

    await createNotification({
      userId:    user.id,
      title:     `${force ? '↺ Brief refreshed' : 'Morning brief ready'} — ${now.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'short' })}`,
      body:      content.slice(0, 120) + (content.length > 120 ? '…' : ''),
      type:      'ai', domain: 'ai', actionUrl: '/platform/dashboard',
    })

    return NextResponse.json({ content, brief_date: today, cached: false, refreshed: force })

  } catch (err: unknown) {
    console.error('Brief generation error:', err)
    return NextResponse.json({ error: err.message ?? 'Brief generation failed' }, { status: 500 })
  }
}
