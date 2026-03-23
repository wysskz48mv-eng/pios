import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

export const runtime = 'nodejs'
export const maxDuration = 30

// POST /api/payroll/detect
// Scans recent emails for payroll data from the accountant.
// If found, extracts pay lines and creates a draft payroll run.

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Fetch recent unprocessed emails likely to be payroll
    const { data: emails } = await supabase.from('email_items')
      .select('id, subject, sender_name, sender_email, snippet, body_text, received_at')
      .eq('user_id', user.id)
      .or('subject.ilike.%payroll%,subject.ilike.%salary%,subject.ilike.%remittance%,subject.ilike.%wages%,subject.ilike.%pay run%')
      .order('received_at', { ascending: false })
      .limit(5)

    if (!emails?.length) {
      return NextResponse.json({ detected: false, message: 'No payroll emails found in inbox. Sync Gmail first.' })
    }

    // Get existing staff for matching
    const { data: staff } = await supabase.from('staff_members')
      .select('full_name, email, monthly_salary, salary_currency').eq('user_id', user.id).eq('is_active', true)

    const staffList = staff?.map(s => `${s.full_name} (${s.email}) — ${s.salary_currency} ${s.monthly_salary}/month`).join('\n') ?? 'No staff on record'

    for (const email of emails) {
      const text = email.body_text ?? email.snippet ?? ''
      const system = `You are a payroll data extraction AI. Extract payroll run data from this email.
Known staff: ${staffList}

Return ONLY valid JSON or null if this is not a payroll email:
{
  "is_payroll": true,
  "pay_period": "Month YYYY",
  "pay_date": "YYYY-MM-DD or null",
  "company_entity": "entity name or null",
  "currency": "GBP",
  "lines": [
    {
      "staff_name": "Full Name",
      "staff_email": "email@example.com",
      "gross_pay": 0.00,
      "tax_deduction": 0.00,
      "ni_deduction": 0.00,
      "pension": 0.00,
      "other_deductions": 0.00,
      "net_pay": 0.00
    }
  ],
  "confidence": 0.0
}`

      let extracted: any = null
      try {
        const raw = await callClaude(
          [{ role: 'user', content: `Email from: ${email.sender_name} <${email.sender_email}>\nSubject: ${email.subject}\n\n${text}` }],
          system, 1500
        )
        const clean = raw.replace(/```json|```/g, '').trim()
        extracted = JSON.parse(clean)
      } catch {
        continue
      }

      if (!extracted?.is_payroll || !extracted?.lines?.length) continue

      const totalGross = extracted.lines.reduce((s: number, l: any) => s + (l.gross_pay || 0), 0)
      const totalNet   = extracted.lines.reduce((s: number, l: any) => s + (l.net_pay || 0), 0)
      const totalTax   = extracted.lines.reduce((s: number, l: any) => s + (l.tax_deduction || 0) + (l.ni_deduction || 0), 0)

      const { data: run } = await supabase.from('payroll_runs').insert({
        user_id: user.id,
        pay_period: extracted.pay_period,
        pay_date: extracted.pay_date,
        status: 'draft',
        source: 'email_detected',
        source_email_id: email.id,
        total_gross: totalGross,
        total_net: totalNet,
        total_tax: totalTax,
        currency: extracted.currency ?? 'GBP',
        company_entity: extracted.company_entity,
        notes: `Auto-detected from email: "${email.subject}" — ${email.sender_name}`,
      }).select('id').single()

      if (run) {
        await supabase.from('payroll_lines').insert(
          extracted.lines.map((l: any) => ({ ...l, payroll_run_id: run.id, user_id: user.id }))
        )
      }

      return NextResponse.json({
        detected: true,
        run_id: run?.id,
        pay_period: extracted.pay_period,
        staff_count: extracted.lines.length,
        total_net: totalNet,
        currency: extracted.currency ?? 'GBP',
        email_subject: email.subject,
        confidence: extracted.confidence,
        message: `Payroll run detected for ${extracted.pay_period} — ${extracted.lines.length} staff members, net total ${extracted.currency} ${totalNet.toFixed(2)}. Review and approve to issue remittances.`,
        hitl_required: true,
      })
    }

    return NextResponse.json({ detected: false, message: 'Payroll emails found but no extractable pay data. Review manually.' })
  } catch (err: any) {
    console.error('/api/payroll/detect:', err)
    return NextResponse.json({ error: err.message ?? 'Detection failed' }, { status: 500 })
  }
}
