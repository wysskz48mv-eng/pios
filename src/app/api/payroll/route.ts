import { apiError } from '@/lib/api-error'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payroll?type=runs|lines|staff|transfers|claims
// POST /api/payroll { action, ...payload }
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') ?? 'runs'

    if (type === 'runs') {
      const { data } = await supabase.from('payroll_runs')
        .select('*, payroll_lines(id, staff_name, net_pay, remittance_sent)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(20)
      return NextResponse.json({ runs: data ?? [] })
    }

    if (type === 'lines') {
      const runId = searchParams.get('run_id')
      if (!runId) return NextResponse.json({ error: 'run_id required' }, { status: 400 })
      const { data } = await supabase.from('payroll_lines')
        .select('*').eq('payroll_run_id', runId).order('staff_name')
      return NextResponse.json({ lines: data ?? [] })
    }

    if (type === 'staff') {
      const { data } = await supabase.from('staff_members')
        .select('*').eq('user_id', user.id).eq('is_active', true).order('full_name')
      return NextResponse.json({ staff: data ?? [] })
    }

    if (type === 'transfers') {
      const status = searchParams.get('status')
      let q = supabase.from('transfer_queue').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      if (status && status !== 'all') q = q.eq('status', status)
      const { data } = await q.limit(50)
      return NextResponse.json({ transfers: data ?? [] })
    }

    if (type === 'claims') {
      const status = searchParams.get('status')
      let q = supabase.from('expense_claims').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      if (status && status !== 'all') q = q.eq('status', status)
      const { data } = await q.limit(50)
      return NextResponse.json({ claims: data ?? [] })
    }

    if (type === 'stats') {
      const now = new Date().toISOString()
      const [runsR, claimsR, transfersR, overdueR] = await Promise.all([
        supabase.from('payroll_runs').select('id', { count: 'exact' }).eq('user_id', user.id).neq('status', 'paid'),
        supabase.from('expense_claims').select('id', { count: 'exact' }).eq('user_id', user.id).eq('status', 'submitted'),
        supabase.from('transfer_queue').select('id', { count: 'exact' }).eq('user_id', user.id).eq('status', 'queued'),
        supabase.from('payroll_runs').select('id', { count: 'exact' }).eq('user_id', user.id)
          .lt('expected_by', now).not('status', 'in', '("paid","approved")'),
      ])
      return NextResponse.json({
        pendingRuns: runsR.count ?? 0,
        pendingClaims: claimsR.count ?? 0,
        queuedTransfers: transfersR.count ?? 0,
        overduePayroll: overdueR.count ?? 0,
      })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { action } = body

    // Create payroll run
    if (action === 'create_run') {
      const { pay_period, pay_date, company_entity, currency, notes, lines, expected_by } = body
      const totalGross = lines?.reduce((s: number, l: unknown) => s + (parseFloat((l as any)?.gross_pay) || 0), 0) ?? 0
      const totalNet   = lines?.reduce((s: number, l: unknown) => s + (parseFloat((l as any)?.net_pay) || 0), 0) ?? 0
      const totalTax   = lines?.reduce((s: number, l: unknown) => s + (parseFloat((l as any)?.tax_deduction) || 0) + (parseFloat((l as any)?.ni_deduction) || 0), 0) ?? 0

      const { data: run } = await supabase.from('payroll_runs').insert({
        user_id: user.id, pay_period, pay_date, status: 'pending_approval',
        source: 'manual', total_gross: totalGross, total_net: totalNet,
        total_tax: totalTax, currency: currency ?? 'GBP',
        company_entity, notes, expected_by,
      }).select('id').single()

      if (run && lines?.length) {
        await supabase.from('payroll_lines').insert(
          lines.map((l: Record<string, unknown>) => ({ ...l, payroll_run_id: run.id, user_id: user.id }))
        )
      }
      return NextResponse.json({ created: true, id: run?.id })
    }

    // Approve payroll run — create transfer queue entries
    if (action === 'approve_run') {
      const { run_id } = body
      const { data: lines } = await supabase.from('payroll_lines').select('*').eq('payroll_run_id', run_id)
      const { data: run } = await supabase.from('payroll_runs').select('pay_period, currency').eq('id', run_id).single()

      if (lines?.length) {
        await supabase.from('transfer_queue').insert(
          lines.map((l: Record<string, unknown>) => ({
            user_id: user.id,
            transfer_type: 'payroll',
            payroll_line_id: (l as any)?.id,
            recipient_name: (l as any)?.staff_name,
            recipient_email: (l as any)?.staff_email,
            amount: (l as any)?.net_pay,
            currency: run?.currency ?? 'GBP',
            reference: `Salary ${run?.pay_period ?? ''}`,
            status: 'queued',
            requires_approval: true,
          }))
        )
      }

      await supabase.from('payroll_runs').update({
        status: 'approved', approved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', run_id).eq('user_id', user.id)

      return NextResponse.json({ approved: true, transfersQueued: lines?.length ?? 0 })
    }

    // Approve a transfer
    if (action === 'approve_transfer') {
      const { transfer_id } = body
      await supabase.from('transfer_queue').update({
        status: 'approved', approved_at: new Date().toISOString(),
        approved_by: 'the approved signatory', updated_at: new Date().toISOString(),
      }).eq('id', transfer_id).eq('user_id', user.id)
      return NextResponse.json({ approved: true })
    }

    // Mark transfer completed
    if (action === 'complete_transfer') {
      const { transfer_id, reference } = body
      await supabase.from('transfer_queue').update({
        status: 'completed', completed_at: new Date().toISOString(),
        transfer_reference: reference, updated_at: new Date().toISOString(),
      }).eq('id', transfer_id).eq('user_id', user.id)
      return NextResponse.json({ completed: true })
    }

    // Add staff member
    if (action === 'add_staff') {
      const { staff } = body
      if (!staff?.full_name || !staff?.email) return NextResponse.json({ error: 'Name and email required' }, { status: 400 })
      const { data } = await supabase.from('staff_members').insert({ ...staff, user_id: user.id }).select('id').single()
      return NextResponse.json({ added: true, id: data?.id })
    }

    if (action === 'update_staff') {
      const { id: staffId, ...updates } = body
      if (!staffId) return NextResponse.json({ error: 'id required' }, { status: 400 })
      await (supabase as any).from('staff_members')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', staffId).eq('user_id', user.id)
      return NextResponse.json({ updated: true })
    }

    if (action === 'delete_staff') {
      const { id: staffId } = body
      if (!staffId) return NextResponse.json({ error: 'id required' }, { status: 400 })
      await (supabase as any).from('staff_members').delete().eq('id', staffId).eq('user_id', user.id)
      return NextResponse.json({ deleted: true })
    }

    // Approve expense claim
    if (action === 'approve_claim') {
      const { claim_id } = body
      const { data: claim } = await supabase.from('expense_claims').select('*').eq('id', claim_id).single()
      if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })

      await supabase.from('expense_claims').update({
        status: 'queued_for_payment',
        approved_at: new Date().toISOString(),
        approved_by: 'the approved signatory',
        updated_at: new Date().toISOString(),
      }).eq('id', claim_id).eq('user_id', user.id)

      // Queue payment
      await supabase.from('transfer_queue').insert({
        user_id: user.id,
        transfer_type: 'expense_claim',
        expense_claim_id: claim_id,
        recipient_name: claim.claimant_name,
        recipient_email: claim.claimant_email,
        amount: claim.amount,
        currency: claim.currency ?? 'GBP',
        reference: `Expenses ${claim.claim_period ?? ''}`,
        status: 'queued',
        requires_approval: true,
      })

      return NextResponse.json({ approved: true })
    }

    // Reject claim
    if (action === 'reject_claim') {
      await supabase.from('expense_claims').update({
        status: 'rejected', rejection_reason: body.reason,
        updated_at: new Date().toISOString(),
      }).eq('id', body.claim_id).eq('user_id', user.id)
      return NextResponse.json({ rejected: true })
    }

    // Submit expense claim
    if (action === 'submit_claim') {
      const { claim } = body
      const { data } = await supabase.from('expense_claims').insert({
        ...claim, user_id: user.id, status: 'submitted',
        submitted_at: new Date().toISOString(),
        tax_year: claim.tax_year ?? getTaxYear(),
      }).select('id').single()
      return NextResponse.json({ submitted: true, id: data?.id })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    return apiError(err)
  }
}

function getTaxYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-12
  // UK tax year: April 6 – April 5
  if (month < 4 || (month === 4 && now.getDate() < 6)) {
    return `${year - 1}-${String(year).slice(2)}`
  }
  return `${year}-${String(year + 1).slice(2)}`
}
