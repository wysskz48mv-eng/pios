import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

export const runtime = 'nodejs'
export const maxDuration = 45

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payroll/remit
// Generates remittance notifications for each staff member in a payroll run.
// Creates a transfer queue entry per staff member (requires HITL approval).
// Optionally generates payslip text per person.
//
// body: { run_id, send_notifications?: boolean }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { run_id, preview_only = false } = await request.json()
    if (!run_id) return NextResponse.json({ error: 'run_id required' }, { status: 400 })

    // Fetch payroll run
    const { data: run } = await supabase.from('payroll_runs')
      .select('*').eq('id', run_id).eq('user_id', user.id).single()
    if (!run) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
    if (run.status === 'cancelled') return NextResponse.json({ error: 'Cannot remit a cancelled payroll run' }, { status: 400 })

    // Fetch pay lines
    const { data: lines } = await supabase.from('payroll_lines')
      .select('*').eq('payroll_run_id', run_id).order('staff_name')
    if (!lines?.length) return NextResponse.json({ error: 'No pay lines found for this run' }, { status: 404 })

    // Check for already-remitted lines
    const alreadyRemitted = lines.filter(l => l.remittance_sent)
    if (alreadyRemitted.length === lines.length) {
      return NextResponse.json({ error: 'All remittances already sent for this run', already_sent: true })
    }

    const pendingLines = lines.filter(l => !l.remittance_sent)
    const month = run.pay_period ?? new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

    // Generate remittance content for each staff member
    const system = `You are generating a professional payslip/remittance notification email for a staff member.
The company is VeritasIQ Technologies Ltd (or its subsidiary as specified).
The email should be professional, clear, and concise. Include all financial figures provided.
Return ONLY valid JSON:
{
  "subject": "Pay Advice — [Month] [Year]",
  "body": "Professional email body with all payment details clearly laid out"
}`

    const remittances = []
    for (const line of (pendingLines as any[])) {
      const userPrompt = `Generate remittance notification:
Staff: ${line.staff_name} (${line.staff_email ?? 'no email'})
Pay period: ${month}
Pay date: ${run.pay_date ?? 'TBC'}
Gross pay: ${run.currency} ${parseFloat(line.gross_pay ?? 0).toFixed(2)}
Tax/NI deductions: ${run.currency} ${(parseFloat(line.tax_deduction ?? 0) + parseFloat(line.ni_deduction ?? 0)).toFixed(2)}
Pension: ${run.currency} ${parseFloat(line.pension ?? 0).toFixed(2)}
Other deductions: ${run.currency} ${parseFloat(line.other_deductions ?? 0).toFixed(2)}
Net pay: ${run.currency} ${parseFloat(line.net_pay).toFixed(2)}
Company: ${run.company_entity ?? 'VeritasIQ Technologies Ltd'}`

      let notification = { subject: `Pay Advice — ${month}`, body: `Dear ${line.staff_name},\n\nPlease find your pay advice for ${month}.\n\nNet Pay: ${run.currency} ${parseFloat(line.net_pay).toFixed(2)}\n\nRegards,\nthe approved signatory` }

      try {
        const raw = await callClaude([{ role: 'user', content: userPrompt }], system, 600)
        const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
        if (parsed.subject && parsed.body) notification = parsed
      } catch { /* use default */ }

      remittances.push({
        line_id: line.id,
        staff_name: line.staff_name,
        staff_email: line.staff_email,
        net_pay: line.net_pay,
        currency: run.currency,
        notification,
      })
    }

    if (preview_only) {
      return NextResponse.json({
        preview: true,
        run_id,
        pay_period: month,
        remittances,
        hitl_required: true,
        hitl_message: `${remittances.length} remittance notifications drafted. Review each one, then call this endpoint with preview_only:false to queue transfers and mark remittances as sent.`,
      })
    }

    // Queue bank transfers and mark lines as remittance_sent
    const transferInserts = remittances.map(r => ({
      user_id: user.id,
      transfer_type: 'payroll',
      payroll_run_id: run_id,
      payroll_line_id: r.line_id,
      recipient_name: r.staff_name,
      recipient_email: r.staff_email,
      amount: r.net_pay,
      currency: r.currency ?? 'GBP',
      reference: `Salary ${month}`,
      status: 'queued',
      requires_approval: true,
      remittance_subject: r.notification.subject,
      remittance_body: r.notification.body,
    }))

  try {
      await supabase.from('transfer_queue').insert(transferInserts)

      // Mark lines as remittance_sent
      await supabase.from('payroll_lines').update({
        remittance_sent: true,
        remittance_sent_at: new Date().toISOString(),
      }).in('id', pendingLines.map(l => l.id))

      // Update run status
      await supabase.from('payroll_runs').update({
        status: 'remittance_sent',
        remittance_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', run_id)

      return NextResponse.json({
        success: true,
        run_id,
        remittances_queued: remittances.length,
        transfers_queued: transferInserts.length,
        total_net: remittances.reduce((s, r) => s + parseFloat(r.net_pay ?? 0), 0).toFixed(2),
        currency: run.currency,
        hitl_required: true,
        hitl_message: `${remittances.length} bank transfers queued for your approval. Go to Transfer Queue to approve each payment. Transfers are NOT sent until you explicitly approve them.`,
      })
    } catch (err: unknown) {
      console.error('/api/payroll/remit:', err)
      return NextResponse.json({ error: (err as Error).message ?? 'Remittance failed' }, { status: 500 })
    }

  } catch (persistErr: unknown) {
    console.error('[PIOS] payroll/remit:', persistErr)
    return NextResponse.json({ error: (persistErr as Error).message ?? 'DB error' }, { status: 500 })
  }}
