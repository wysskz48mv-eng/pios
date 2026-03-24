/**
 * GET /api/cron/brief
 * Vercel Cron — runs daily at 06:00 UTC (08:00 UAE / 07:00 UK)
 * Generates morning briefs for all active PIOS users.
 *
 * Uses upsert — always overwrites any existing brief for today.
 * This means re-running the cron (or triggering it manually) refreshes
 * every user's brief with current data rather than skipping them.
 *
 * Context per user:
 *   - Overdue tasks (flagged prominently)
 *   - Due-today and upcoming tasks
 *   - Unbilled expenses + queued transfers
 *   - Academic modules + thesis velocity
 *   - FM news (last 24h)
 *   - CFP deadlines (next 30 days)
 *
 * PIOS v2.2 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callClaude } from '@/lib/ai/client'
import { sendEmail, morningBriefHtml, morningBriefText } from '@/lib/email/resend'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 300

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

function authOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin  = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const today  = new Date().toISOString().slice(0, 10)
  const now    = new Date()
  const start  = Date.now()

  const { data: profiles, error: profErr } = await admin
    .from('user_profiles')
    .select('id, full_name, billing_email, google_email')
    .limit(100)

  if (profErr || !profiles) {
    console.error('[cron/brief] Failed to fetch profiles:', profErr)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  let generated = 0, failed = 0

  for (const profile of profiles) {
    const uid = profile.id
    try {
      // Gather full context for this user
      const [tasksR, modulesR, chaptersR, projectsR, fmNewsR, cfpR, expensesR, payrollR, meetingsR, pendingActionsR, receiptsR] = await Promise.all([
        admin.from('tasks').select('title,domain,priority,due_date,status')
          .eq('user_id', uid).not('status', 'in', '("done","cancelled")')
          .order('due_date', { ascending: true }).limit(15),
        admin.from('academic_modules').select('title,status,deadline')
          .eq('user_id', uid).not('status', 'in', '("passed","failed")').limit(5),
        admin.from('thesis_chapters').select('title,chapter_num,status,word_count,target_words')
          .eq('user_id', uid).order('chapter_num').limit(5),
        admin.from('projects').select('title,domain,status,progress')
          .eq('user_id', uid).eq('status', 'active').limit(4),
        admin.from('fm_news_items').select('headline,category,relevance')
          .eq('user_id', uid)
          .gte('fetched_at', new Date(Date.now() - 86400000).toISOString())
          .order('relevance', { ascending: false }).limit(4),
        admin.from('paper_calls').select('title,journal_name,deadline')
          .eq('user_id', uid).in('status', ['new','considering','planning'])
          .gte('deadline', today)
          .lte('deadline', new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10))
          .order('deadline').limit(3),
        admin.from('expenses').select('description,amount,currency,date')
          .eq('user_id', uid).eq('billable', true)
          .is('reimbursed_at', null)
          .order('date', { ascending: false }).limit(4),
        admin.from('transfer_queue').select('description,amount_gbp,status')
          .eq('user_id', uid).eq('status', 'queued').limit(3),
        // Recent meetings + pending action items
        admin.from('meeting_notes').select('title,meeting_date,meeting_type,domain,status,ai_summary,tasks_created')
          .eq('user_id', uid)
          .gte('meeting_date', new Date(Date.now() - 2 * 86400000).toISOString().slice(0,10))
          .order('meeting_date', { ascending: false }).limit(5),
        admin.from('meeting_notes').select('title,meeting_date,ai_action_items')
          .eq('user_id', uid).eq('status', 'processed').eq('tasks_created', false)
          .order('meeting_date', { ascending: false }).limit(3),
        // Auto-captured receipts (last 48h)
        admin.from('email_items').select('subject,sender_name,receipt_data,received_at')
          .eq('user_id', uid).eq('is_receipt', true)
          .gte('received_at', new Date(Date.now() - 48 * 3600000).toISOString())
          .order('received_at', { ascending: false }).limit(5),
      ])

      const tasks     = tasksR.data ?? []
      const overdue   = tasks.filter(t => t.due_date && t.due_date < today)
      const dueToday  = tasks.filter(t => t.due_date === today)
      const upcoming  = tasks.filter(t => !t.due_date || t.due_date > today)

      // Skip users with nothing to brief on
      if (tasks.length + (modulesR.data?.length ?? 0) === 0) continue

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
          ? `UPCOMING (${upcoming.length}):\n` + upcoming.slice(0,5).map(t =>
              `- [${t.priority}] ${t.title} (${t.domain}) — ${t.due_date ? fmt(t.due_date) : 'no date'}`).join('\n')
          : '',

        `ACADEMIC MODULES:\n` + ((modulesR.data ?? []).map(m =>
          `- ${m.title} [${m.status}] — ${m.deadline ? fmt(m.deadline) : 'TBD'}`).join('\n') || 'none'),

        chapters.length > 0
          ? `THESIS: ${totalWords.toLocaleString()}/${targetWords.toLocaleString()} words (${Math.round(totalWords/Math.max(targetWords,1)*100)}%)` +
            (wordsPerDay ? ` · needs ${wordsPerDay.toLocaleString()} words/day` : '') + '\n' +
            chapters.map(c => `- Ch${c.chapter_num} ${c.title}: ${c.word_count ?? 0}/${c.target_words ?? 8000} [${c.status}]`).join('\n')
          : '',

        (projectsR.data ?? []).length > 0
          ? `ACTIVE PROJECTS:\n` + (projectsR.data ?? []).map(p => `- ${p.title} (${p.domain}) — ${p.progress ?? 0}%`).join('\n')
          : '',

        (expensesR.data ?? []).length > 0
          ? `UNBILLED EXPENSES (${expensesR.data?.length}):\n` + (expensesR.data ?? []).map(e => `- ${e.currency} ${e.amount} — ${e.description} (${fmt(e.date)})`).join('\n')
          : '',

        (payrollR.data ?? []).length > 0
          ? `QUEUED TRANSFERS (${payrollR.data?.length}):\n` + (payrollR.data ?? []).map(t => `- GBP ${t.amount_gbp} — ${t.description}`).join('\n')
          : '',

        (fmNewsR.data ?? []).length > 0
          ? `FM INTELLIGENCE:\n` + (fmNewsR.data ?? []).map((n: Record<string, unknown>) => `- [${(n.category ?? '').toUpperCase()}] ${n.headline}`).join('\n')
          : 'FM INTELLIGENCE: no fresh signals',

        (cfpR.data ?? []).length > 0
          ? `PUBLICATION DEADLINES:\n` + (cfpR.data ?? []).map((c: Record<string, unknown>) => `- "${c.title}" — ${c.deadline}`).join('\n')
          : '',
        (meetingsR.data ?? []).length > 0
          ? `RECENT MEETINGS (${meetingsR.data?.length}):\n` +
            (meetingsR.data ?? []).map((m: Record<string, unknown>) =>
              `- [${m.meeting_type?.toUpperCase()}] ${m.title} (${m.meeting_date})${m.ai_summary ? ': ' + m.ai_summary.slice(0, 100) + '...' : ''}${m.tasks_created ? ' [tasks created]' : ''}`
            ).join('\n')
          : '',

        (pendingActionsR.data ?? []).length > 0
          ? `MEETING ACTIONS AWAITING PROMOTION (${pendingActionsR.data?.length} meetings):\n` +
            (pendingActionsR.data ?? []).flatMap((m: unknown) =>
              ((m.ai_action_items ?? []) as unknown[]).slice(0,3).map((a: Record<string, unknown>) =>
                `- [${(a.priority ?? 'medium').toUpperCase()}] ${a.action} — from "${m.title}"`
              )
            ).join('\n')
          : '',

        (receiptsR.data ?? []).length > 0
          ? `AUTO-CAPTURED RECEIPTS (last 48h — ${receiptsR.data?.length}):\n` +
            (receiptsR.data ?? []).map((r: Record<string, unknown>) => {
              const rd = r.receipt_data
              return rd ? `- ${rd.vendor ?? r.sender_name}: ${rd.currency ?? 'GBP'} ${rd.amount ?? '?'}` : `- ${r.subject}`
            }).join('\n')
          : '',

      ].filter(Boolean).join('\n\n')

      const system = `You are PIOS, a personal AI operating system for a DBA student and multi-domain entrepreneur. Generate a personalised morning brief. Be direct. Lead with overdue tasks if any. Flag thesis pace risk. If meeting action items are awaiting task promotion, name them and direct to /platform/meetings. If auto-captured receipts are present, prompt review. Spot cross-domain conflicts. Name 2-3 items needing personal action today. Max 300 words. Plain prose, no bullet points.`

      const content = await callClaude(
        [{ role: 'user', content: `Generate my morning brief.\n\n${ctx}` }],
        system, 500
      )

      // Always upsert — refreshes any existing brief for today
      await admin.from('daily_briefs').upsert({
        user_id:      uid,
        brief_date:   today,
        content,
        ai_model:     'claude-sonnet-4-20250514',
        generated_by: 'cron',
      }, { onConflict: 'user_id,brief_date' })

      // Email delivery
      const userEmail = (profile as Record<string, unknown>).billing_email ?? (profile as Record<string, unknown>).google_email
      const userName  = (profile as Record<string, unknown>).full_name ?? 'there'
      if (userEmail) {
        await sendEmail({
          to:      userEmail,
          subject: `Your PIOS Brief — ${new Date(today).toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })}`,
          html:    morningBriefHtml(content, today, userName),
          text:    morningBriefText(content, today, userName),
        }).catch(() => {})

        // Task urgency alert — separate email if overdue or due tomorrow
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
        const urgentTasks = tasks.filter(t =>
          (t.due_date && t.due_date < today) ||  // overdue
          t.due_date === today ||                  // due today
          t.due_date === tomorrow                  // due tomorrow
        )
        if (urgentTasks.length > 0 && overdue.length > 0) {
          // Only send separate alert email if there are actually overdue tasks
          const overdueLines = overdue.map(t =>
            `• [${(t.priority??'').toUpperCase()}] ${t.title} — was due ${t.due_date}`
          ).join('\n')
          const dueTodayLines = dueToday.map(t => `• ${t.title} [${t.domain}]`).join('\n')
          await sendEmail({
            to:      userEmail,
            subject: `⚠ ${overdue.length} overdue task${overdue.length > 1 ? 's' : ''} — PIOS Alert`,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <h2 style="color:#ef4444;margin-bottom:8px">⚠ Overdue Tasks (${overdue.length})</h2>
              <pre style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:12px;font-size:13px;white-space:pre-wrap">${overdueLines}</pre>
              ${dueTodayLines ? `<h3 style="color:#f97316;margin-top:16px">Due Today</h3><pre style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:12px;font-size:13px;white-space:pre-wrap">${dueTodayLines}</pre>` : ''}
              <p style="color:#6b7280;font-size:12px;margin-top:16px">Sent by PIOS · <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://pios.sustain-intl.com'}/platform/tasks">View all tasks →</a></p>
            </div>`,
            text: `OVERDUE TASKS (${overdue.length}):\n${overdueLines}\n${dueTodayLines ? '\nDUE TODAY:\n' + dueTodayLines : ''}`,
          }).catch(() => {})
        }
      }

      generated++
    } catch (err: unknown) {
      console.error(`[cron/brief] Failed for user ${uid}:`, err.message)
      failed++
    }
  }

  const elapsed = Math.round((Date.now() - start) / 1000)

  return NextResponse.json({ date: today, generated, failed, elapsed_s: elapsed })
}
