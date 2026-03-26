/**
 * GET /api/cron/supervisor-digest
 * Weekly cron (Monday 08:00 UTC) — sends supervisor a digest of each
 * supervised student's progress: word count, milestone completion, CPD hours.
 * PIOS v2.2 | Sprint 25
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }               from '@/lib/supabase/server'
import { Resend }                     from 'resend'

export const dynamic     = 'force-dynamic'
export const maxDuration = 30

const FROM = process.env.FROM_EMAIL ?? 'noreply@veritasiq.io'

function wrap(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#1e293b;padding:20px 28px;">
        <p style="margin:0;font-size:18px;font-weight:800;color:#e2e8f0;">PIOS</p>
        <p style="margin:4px 0 0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Weekly Supervisor Digest</p>
      </td></tr>
      <tr><td style="padding:28px;">${body}</td></tr>
    </table>
  </td></tr>
</table></body></html>`
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db     = createClient()
  const resend = new Resend(process.env.RESEND_API_KEY ?? '')
  const now    = new Date()
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)

  const sent: string[] = []
  const errs: string[] = []

  // Get all users who have a supervisor email set
  const { data: profiles } = await db
    .from('user_profiles')
    .select('user_id,full_name,supervisor_email,supervisor_name,programme_title,institution')
    .not('supervisor_email', 'is', null)
    .limit(200)

  // Group by supervisor email
  const bySupervisor: Record<string, NonNullable<typeof profiles>> = {}
  for (const p of (profiles ?? [])) {
    if (!p.supervisor_email) continue
    const k = String(p.supervisor_email)
    if (!bySupervisor[k]) bySupervisor[k] = [] as NonNullable<typeof profiles>
    bySupervisor[k]!.push(p)
  }

  for (const [supervisorEmail, students] of Object.entries(bySupervisor)) {
    const supervisorName = students[0]?.supervisor_name ?? 'Supervisor'
    const rows: string[] = []

    for (const student of (students ?? [])) {
      // Fetch chapter progress
      const { data: chapters } = await db
        .from('thesis_chapters')
        .select('chapter_num,title,status,word_count,target_words,updated_at')
        .eq('user_id', String(student.user_id))
        .order('chapter_num')

      const totalWords  = (chapters ?? []).reduce((s, c) => s + (Number(c.word_count) || 0), 0)
      const targetWords = (chapters ?? []).reduce((s, c) => s + (Number(c.target_words) || 8000), 0)
      const pct         = targetWords > 0 ? Math.round((totalWords / targetWords) * 100) : 0
      const doneCh      = (chapters ?? []).filter(c => c.status === 'submitted' || c.status === 'passed').length

      // Recent milestones
      const { data: milestones } = await db
        .from('programme_milestones')
        .select('title,status,due_date')
        .eq('user_id', String(student.user_id))
        .order('due_date', { ascending: true })
        .limit(3)

      const overdue = (milestones ?? []).filter(m =>
        m.status !== 'completed' && m.due_date && new Date(m.due_date) < now
      )

      // CPD hours this year
      const thisYear = now.getFullYear().toString()
      const { data: cpd } = await db
        .from('cpd_activities')
        .select('hours_claimed')
        .eq('user_id', String(student.user_id))
        .gte('activity_date', `${thisYear}-01-01`)

      const cpdTotal = (cpd ?? []).reduce((s, r) => s + (Number(r.hours_claimed) || 0), 0)

      const overdueHtml = overdue.length > 0
        ? `<p style="color:#ef4444;font-size:12px;margin:4px 0 0;">Overdue milestones: ${overdue.map(m => m.title).join(', ')}</p>`
        : ''

      rows.push(`
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;vertical-align:top;">
            <p style="margin:0;font-size:14px;font-weight:700;color:#0f172a;">${String(student.full_name ?? 'Student')}</p>
            <p style="margin:2px 0 0;font-size:11px;color:#64748b;">${String(student.programme_title ?? '')} | ${String(student.institution ?? '')}</p>
            ${overdueHtml}
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;text-align:right;vertical-align:top;white-space:nowrap;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#0e5ca4;">${totalWords.toLocaleString()} words</p>
            <p style="margin:2px 0 0;font-size:11px;color:#64748b;">${pct}% of target | ${doneCh}/${(chapters ?? []).length} ch.</p>
          </td>
          <td style="padding:10px 0 10px 8px;border-bottom:1px solid #f1f5f9;text-align:right;vertical-align:top;white-space:nowrap;">
            <p style="margin:0;font-size:13px;font-weight:600;color:#0ECFB0;">${cpdTotal}h CPD</p>
            <p style="margin:2px 0 0;font-size:11px;color:#64748b;">this year</p>
          </td>
        </tr>`)
    }

    const html = wrap(`
      <p style="margin:0 0 4px;font-size:14px;color:#374151;">Dear ${supervisorName},</p>
      <p style="margin:0 0 20px;font-size:13px;color:#6b7280;">Here is your weekly progress summary for week ending ${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <th style="text-align:left;font-size:11px;color:#94a3b8;padding-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">Student</th>
          <th style="text-align:right;font-size:11px;color:#94a3b8;padding-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">Progress</th>
          <th style="text-align:right;font-size:11px;color:#94a3b8;padding-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">CPD</th>
        </tr>
        ${rows.join('')}
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;">Powered by PIOS — VeritasIQ Technologies Ltd</p>`)

    try {
      await resend.emails.send({
        from:    `PIOS <${FROM}>`,
        to:      supervisorEmail,
        subject: `Weekly student digest — ${students.length} student${students.length > 1 ? 's' : ''} (${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})`,
        html,
      })
      sent.push(`${supervisorEmail} (${students.length} students)`)
    } catch (e: unknown) {
      errs.push(`${supervisorEmail}: ${String((e as Error).message)}`)
    }
  }

  return NextResponse.json({
    ok:              true,
    ran_at:          now.toISOString(),
    supervisors_emailed: sent.length,
    errors:          errs.length,
    detail:          { sent, errs },
  })
}
