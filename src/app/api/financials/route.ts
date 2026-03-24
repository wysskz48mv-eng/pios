/**
 * /api/financials — Group Financial Overview: snapshots + expense/payroll aggregation
 * PIOS Sprint 36 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { callClaude }                from '@/lib/ai/client'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date()
    const thisMonth = `${now.toLocaleString('en-GB', { month: 'short' })} ${now.getFullYear()}`
    const yearStart = `${now.getFullYear()}-01-01`

    // Pull live data from existing modules
    const [snapshotsR, expensesR, payrollR, contractsR] = await Promise.all([
      supabase.from('financial_snapshots').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(12),
      supabase.from('expenses').select('amount,currency,category,domain,expense_date').eq('user_id', user.id).gte('expense_date', yearStart),
      supabase.from('payroll_runs').select('net_amount,currency,period').eq('user_id', user.id).gte('created_at', yearStart),
      supabase.from('contracts').select('title,value,currency,contract_type,status,end_date').eq('user_id', user.id).eq('status', 'active'),
    ])

    // Aggregate expenses by domain
    const expenses = (expensesR.data ?? []) as any[]
    const expByDomain: Record<string, number> = {}
    let totalExpenses = 0
    for (const e of expenses) {
      const d = String(e.domain ?? 'other')
      expByDomain[d] = (expByDomain[d] ?? 0) + Number(e.amount ?? 0)
      totalExpenses += Number(e.amount ?? 0)
    }

    // Payroll total YTD
    const payrollYTD = ((payrollR.data ?? []) as any[]).reduce((s: number, r: any) => s + Number(r.net_amount ?? 0), 0)

    // Contract value pipeline
    const activeContractValue = ((contractsR.data ?? []) as any[]).reduce((s: number, c: any) => s + Number(c.value ?? 0), 0)

    // Build month-by-month summary from expenses
    const monthlyMap: Record<string, { expenses: number; payroll: number }> = {}
    for (const e of expenses) {
      const m = new Date(e.expense_date).toLocaleString('en-GB', { month: 'short', year: 'numeric' })
      if (!monthlyMap[m]) monthlyMap[m] = { expenses: 0, payroll: 0 }
      monthlyMap[m].expenses += Number(e.amount ?? 0)
    }
    for (const r of (payrollR.data ?? []) as any[]) {
      const m = String(r.period ?? 'Unknown')
      if (!monthlyMap[m]) monthlyMap[m] = { expenses: 0, payroll: 0 }
      monthlyMap[m].payroll += Number(r.net_amount ?? 0)
    }

    return NextResponse.json({
      snapshots: snapshotsR.data ?? [],
      summary: {
        totalExpensesYTD: totalExpenses,
        payrollYTD,
        activeContractValue,
        expByDomain,
        monthlyBreakdown: monthlyMap,
      },
      contracts: contractsR.data ?? [],
    })
  } catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: prof } = await supabase.from('user_profiles').select('tenant_id,full_name,organisation').eq('id', user.id).single()
    const p = prof as any
    if (!p?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const body = await req.json() as Record<string, unknown>
    const action = body.action as string

    if (action === 'save_snapshot') {
      const { data, error } = await supabase.from('financial_snapshots').insert({
        user_id: user.id, tenant_id: p.tenant_id,
        period: body.period, period_type: body.period_type ?? 'month',
        entity: body.entity ?? 'group', revenue: body.revenue ?? 0,
        expenses: body.expenses ?? 0, payroll_cost: body.payroll_cost ?? 0,
        currency: body.currency ?? 'GBP', cash_position: body.cash_position ?? 0,
        receivables: body.receivables ?? 0, payables: body.payables ?? 0,
        notes: body.notes ?? null,
      }).select().single()
      if (error) throw error
      return NextResponse.json({ snapshot: data })
    }

    if (action === 'ai_commentary') {
      const { summary } = body as any
      const commentary = await callClaude([{ role: 'user', content: `You are the Group CFO adviser for ${p.full_name ?? 'a founder'} at ${p.organisation ?? 'a technology company'}.\n\nFinancial summary (YTD):\n- Total expenses: £${Number(summary?.totalExpensesYTD ?? 0).toFixed(0)}\n- Payroll YTD: £${Number(summary?.payrollYTD ?? 0).toFixed(0)}\n- Active contract pipeline: £${Number(summary?.activeContractValue ?? 0).toFixed(0)}\n- Expense breakdown by domain: ${JSON.stringify(summary?.expByDomain ?? {})}\n\nProvide a CFO-grade financial commentary:\n1. BURN RATE ASSESSMENT — is the spending level sustainable and appropriate?\n2. DOMAIN ALLOCATION — is spending concentrated where it should be relative to revenue potential?\n3. CASH MANAGEMENT — any risk of cash flow pressure based on the pipeline vs expense run-rate?\n4. COST OPTIMISATION — the single biggest opportunity to reduce cost without reducing output\n5. FINANCIAL RISK — top financial risk in the next 90 days and recommended mitigation\n\nBe direct and specific. No generic CFO boilerplate.` }], 'claude-sonnet-4-20250514', 0.3)
      return NextResponse.json({ commentary })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }) }
}
