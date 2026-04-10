import { apiError } from '@/lib/api-error'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

export const runtime = 'nodejs'
export const maxDuration = 30

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payroll/chase
// Checks if payroll has been received by its expected date.
// If not, generates a graded chase communication and logs it.
// Chase levels: reminder (day 1) → escalation (day 3) → formal (day 5+)
//
// body: { expected_date?: string } — defaults to last working day of current month
// GET  /api/payroll/chase — returns chase log history
// ─────────────────────────────────────────────────────────────────────────────

function getLastWorkingDayOfMonth(): string {
  const now = new Date()
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0) // last day of month
  // Walk back if weekend
  while (last.getDay() === 0 || last.getDay() === 6) last.setDate(last.getDate() - 1)
  return last.toISOString().slice(0, 10)
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { expected_date, accountant_email, accountant_name = 'Accountant' } = await request.json()
    const payrollDueDate = expected_date ?? getLastWorkingDayOfMonth()
    const today = new Date()
    const dueDate = new Date(payrollDueDate)
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / 86400000)

    // Check if payroll has actually been received this month
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
    const { data: recentRuns } = await supabase.from('payroll_runs')
      .select('id, pay_period, pay_date, status, created_at')
      .eq('user_id', user.id)
      .gte('created_at', monthStart)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(3)

    if (recentRuns && recentRuns.length > 0) {
      return NextResponse.json({
        chase_needed: false,
        message: `Payroll received this month (${recentRuns[0].pay_period ?? 'current period'}). No chase needed.`,
        latest_run: recentRuns[0],
      })
    }

    // Not yet received — determine chase level
    if (daysOverdue <= 0) {
      return NextResponse.json({
        chase_needed: false,
        message: `Payroll due date (${payrollDueDate}) not yet reached. No action required.`,
        due_date: payrollDueDate,
      })
    }

    const chaseLevel = daysOverdue >= 5 ? 'formal' : daysOverdue >= 3 ? 'escalation' : 'reminder'
    const month = today.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

    // Check if we've already sent a chase at this level this month
    const { data: existingChase } = await supabase.from('payroll_chase_log')
      .select('id, chase_level, sent_at')
      .eq('user_id', user.id)
      .eq('chase_level', chaseLevel)
      .gte('sent_at', monthStart)
      .limit(1)

    if (existingChase && existingChase.length > 0) {
      return NextResponse.json({
        chase_needed: true,
        already_sent: true,
        chase_level: chaseLevel,
        sent_at: existingChase[0].sent_at,
        message: `${chaseLevel} chase already sent this month on ${new Date(existingChase[0].sent_at).toLocaleDateString('en-GB')}`,
      })
    }

    // Generate chase email draft
    const system = `You are drafting a professional payroll chase email on behalf of the approved signatory, Group CEO of VeritasIQ Technologies Ltd.
The tone must be professional but appropriately firm based on the chase level.
Chase levels:
- reminder: polite reminder, assume oversight, friendly
- escalation: more direct, noting it is the second communication, requesting urgent response
- formal: formal tone, noting urgency, referencing staff payment obligations, requesting immediate action

Return ONLY valid JSON:
{
  "subject": "email subject line",
  "body": "full email body (plain text, professional formatting with line breaks)",
  "urgency": "low|medium|high",
  "suggested_follow_up_days": 2
}`

    const userPrompt = `Draft a "${chaseLevel}" level payroll chase email.
To: ${accountant_name}${accountant_email ? ` <${accountant_email}>` : ''}
Month: ${month}
Days overdue: ${daysOverdue}
Expected date: ${payrollDueDate}
From: the approved signatory, Group CEO, VeritasIQ Technologies Ltd
Staff count: unknown (accountant has the details)`

    const raw = await callClaude(
      [{ role: 'user', content: userPrompt }],
      system, 800
    )

    let draft: any = {}
    try {
      draft = JSON.parse(raw.replace(/```json|```/g, '').trim())
    } catch {
      draft = { subject: `Payroll Chase — ${month}`, body: raw, urgency: 'medium' }
    }

    // Log the chase
  try {
      await supabase.from('payroll_chase_log').insert({
        user_id: user.id,
        chase_level: chaseLevel,
        days_overdue: daysOverdue,
        expected_date: payrollDueDate,
        accountant_email: accountant_email ?? null,
        draft_subject: draft.subject,
        draft_body: draft.body,
        sent_at: new Date().toISOString(),
        status: 'draft',  // User must confirm before sending
      })

      return NextResponse.json({
        chase_needed: true,
        chase_level: chaseLevel,
        days_overdue: daysOverdue,
        expected_date: payrollDueDate,
        draft,
        hitl_required: true,
        hitl_message: `${chaseLevel.charAt(0).toUpperCase() + chaseLevel.slice(1)} chase email drafted. Review and send manually — PIOS will not send emails without your explicit approval.`,
      })
    } catch (err: unknown) {
      console.error('/api/payroll/chase:', err)
      return NextResponse.json({ error: (err as Error).message ?? 'Chase check failed' }, { status: 500 })
    }

  } catch (persistErr: unknown) {
    console.error('[PIOS] payroll/chase:', persistErr)
    return NextResponse.json({ error: (persistErr as Error).message ?? 'DB error' }, { status: 500 })
  }}

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase.from('payroll_chase_log')
      .select('*').eq('user_id', user.id)
      .order('sent_at', { ascending: false }).limit(20)
    return NextResponse.json({ log: data ?? [] })
  } catch (err: unknown) {
    return apiError(err)
  }
}
