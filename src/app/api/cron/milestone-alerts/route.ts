/**
 * GET /api/cron/milestone-alerts
 * Daily cron (07:00 UTC): emails supervisor when milestones are upcoming.
 * Also emails the student for overdue items.
 * PIOS v3.0 | Sprint 21
 */
import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import { Resend }                    from 'resend'
import { requireCronSecret }         from '@/lib/security/route-guards'

export const runtime    = 'nodejs'
export const maxDuration = 30

const FROM = process.env.FROM_EMAIL ?? 'noreply@veritasiq.io'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
}

export async function GET(req: NextRequest) {
  try {
  const authErr = requireCronSecret(req)
  if (authErr) return authErr

  const resend = new Resend(process.env.RESEND_API_KEY ?? '')
  const db     = admin()
  const now    = new Date()
  const today  = now.toISOString().slice(0, 10)

  // Get all upcoming milestones where alert is due and not yet sent
  const { data: milestones } = await db
    .from('programme_milestones')
    .select('id,user_id,title,target_date,alert_days_before,status,persona')
    .in('status', ['upcoming', 'in_progress'])
    .not('target_date', 'is', null)
    .eq('alert_sent', false)

  let emailsSent = 0
  const results: string[] = []

  for (const m of milestones ?? []) {
    const targetDate  = new Date(m.target_date)
    const daysUntil   = Math.ceil((targetDate.getTime() - now.getTime()) / 86400000)
    const isOverdue   = daysUntil < 0
    const isDueSoon   = daysUntil >= 0 && daysUntil <= (m.alert_days_before ?? 14)

    if (!isOverdue && !isDueSoon) continue

    // Get user profile (for email + name + supervisor details)
    const { data: profile } = await db
      .from('user_profiles')
      .select('full_name,google_email,supervisor_name,supervisor_email,programme_name,cpd_body')
      .eq('id', m.user_id)
      .single()

    if (!profile?.google_email) continue

    const studentName  = profile.full_name ?? 'Student'
    const programme    = profile.programme_name ?? m.persona?.replace('_', ' ') ?? 'Programme'
    const subjectLine  = isOverdue
      ? `OVERDUE: ${m.title} — PIOS Alert`
      : `Upcoming milestone in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}: ${m.title}`

    const bodyHtml = `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">
        <div style="background:#8B5CF6;padding:20px 24px;border-radius:8px 8px 0 0">
          <p style="color:#fff;font-size:12px;margin:0;opacity:0.8">PIOS Learning Tracker</p>
          <h2 style="color:#fff;font-size:18px;margin:6px 0 0">${isOverdue ? 'Overdue Milestone' : 'Upcoming Milestone'}</h2>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
          <p style="font-size:14px;color:#374151">Dear ${studentName},</p>
          <div style="background:${isOverdue ? '#fef2f2' : '#f5f3ff'};border-left:4px solid ${isOverdue ? '#ef4444' : '#8B5CF6'};padding:14px 16px;border-radius:4px;margin:16px 0">
            <p style="font-size:13px;font-weight:700;color:${isOverdue ? '#b91c1c' : '#6d28d9'};margin:0 0 4px">
              ${isOverdue ? 'OVERDUE' : `Due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`}
            </p>
            <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 4px">${m.title}</p>
            <p style="font-size:12px;color:#6b7280;margin:0">${programme} · Target: ${fmtDate(m.target_date)}</p>
          </div>
          <p style="font-size:13px;color:#6b7280">Log into PIOS to update your progress or mark this milestone complete.</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://pios.veritasiq.io'}/platform/learning" style="display:inline-block;background:#8B5CF6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;margin-top:8px">View in PIOS →</a>
        </div>
      </div>
    `

    // Email the student
    await resend.emails.send({
      from: `PIOS <${FROM}>`, to: profile.google_email,
      subject: subjectLine, html: bodyHtml,
    })

    emailsSent++

    // If supervisor email set and milestone is doctoral, email supervisor too
    if (profile.supervisor_email && m.persona === 'doctoral' && !isOverdue) {
      await resend.emails.send({
        from: `PIOS <${FROM}>`, to: profile.supervisor_email,
        subject: `[Supervision] ${studentName}: "${m.title}" due ${fmtDate(m.target_date)}`,
        html: bodyHtml.replace(`Dear ${studentName}`, `Dear ${profile.supervisor_name ?? 'Supervisor'}`),
      })
      emailsSent++
    }

    // Mark alert sent
    await db.from('programme_milestones')
      .update({ alert_sent: true, updated_at: new Date().toISOString() })
      .eq('id', m.id)

    results.push(`${studentName}: ${m.title} (${isOverdue ? 'overdue' : `${daysUntil}d`})`)
  }

  return NextResponse.json({
    ok: true, ran_at: today,
    checked:     (milestones ?? []).length,
    emails_sent: emailsSent,
    alerts:      results,
  })
} catch (err: any) {
    console.error('[PIOS cron/milestone-alerts]', err)
    return apiError(err)
  }
}
