import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type InvoiceRow = {
  id: string
  invoice_number: string | null
  invoice_type: string | null
  supplier_name: string | null
  client_name: string | null
  total_amount: number | string | null
  amount_paid: number | string | null
  amount_due: number | string | null
  invoice_date: string | null
  due_date: string | null
  paid_date: string | null
  status: string | null
  currency: string | null
  updated_at: string | null
}

function toAmount(value: number | string | null | undefined): number {
  return Number(value ?? 0)
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const next30 = new Date(today)
    next30.setDate(today.getDate() + 30)
    const next30Str = next30.toISOString().split('T')[0]

    const [invoicesR, expensesR] = await Promise.all([
      supabase
        .from('invoices')
        .select('id,invoice_number,invoice_type,supplier_name,client_name,total_amount,amount_paid,amount_due,invoice_date,due_date,paid_date,status,currency,updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(200),
      supabase
        .from('expenses')
        .select('amount,expense_date')
        .eq('user_id', user.id)
        .gte('expense_date', monthStart),
    ])

    if (invoicesR.error) throw invoicesR.error
    if (expensesR.error) throw expensesR.error

    const invoices = (invoicesR.data ?? []) as InvoiceRow[]
    const expenses = expensesR.data ?? []
    const expensesThisMonth = expenses.reduce((sum, row) => sum + toAmount((row as { amount?: number | string | null }).amount ?? 0), 0)

    let totalInvoiced = 0
    let totalPaid = 0
    let outstanding = 0
    let overdue = 0
    let overdueCount = 0
    let averageCollectionDaysTotal = 0
    let averageCollectionDaysCount = 0
    let cashFlow30day = 0

    const statusBreakdown = {
      pending: 0,
      approved: 0,
      paid: 0,
      overdue: 0,
      disputed: 0,
      cancelled: 0,
    }

    const aging = {
      current: 0,
      days_30: 0,
      days_60: 0,
      days_90_plus: 0,
    }

    for (const invoice of invoices) {
      const total = toAmount(invoice.total_amount)
      const paid = toAmount(invoice.amount_paid)
      const due = invoice.amount_due == null ? Math.max(total - paid, 0) : toAmount(invoice.amount_due)
      const invoiceType = invoice.invoice_type ?? 'receivable'
      const dueDateStr = invoice.due_date
      const dueDate = dueDateStr ? new Date(dueDateStr) : null
      const invoiceDate = invoice.invoice_date ? new Date(invoice.invoice_date) : null
      const paidDate = invoice.paid_date ? new Date(invoice.paid_date) : null
      const isReceivable = invoiceType !== 'payable' && invoiceType !== 'expense'
      const isOutstanding = due > 0 && invoice.status !== 'cancelled'
      const isOverdue = Boolean(isOutstanding && dueDate && dueDate < today)

      if (invoice.status && invoice.status in statusBreakdown) {
        statusBreakdown[invoice.status as keyof typeof statusBreakdown] += 1
      }

      if (isReceivable) {
        totalInvoiced += total
        totalPaid += paid
        outstanding += due
        if (isOverdue) {
          overdue += due
          overdueCount += 1
          const overdueDays = daysBetween(dueDate as Date, today)
          if (overdueDays <= 30) aging.days_30 += due
          else if (overdueDays <= 60) aging.days_60 += due
          else aging.days_90_plus += due
        } else {
          aging.current += due
        }
        if (invoiceDate && paidDate && paid > 0) {
          averageCollectionDaysTotal += Math.max(daysBetween(invoiceDate, paidDate), 0)
          averageCollectionDaysCount += 1
        }
      }

      if (dueDate && dueDateStr && due > 0 && invoice.status !== 'cancelled' && dueDateStr >= monthStart && dueDateStr <= next30Str) {
        cashFlow30day += isReceivable ? due : -due
      }
    }

    return NextResponse.json({
      total_invoiced: totalInvoiced,
      total_paid: totalPaid,
      outstanding,
      overdue,
      overdue_count: overdueCount,
      cash_flow_30day: cashFlow30day,
      average_collection_days: averageCollectionDaysCount > 0
        ? Math.round(averageCollectionDaysTotal / averageCollectionDaysCount)
        : 0,
      expenses_this_month: expensesThisMonth,
      aging,
      status_breakdown: statusBreakdown,
      recent_invoices: invoices.slice(0, 8).map((invoice) => ({
        ...invoice,
        total_amount: toAmount(invoice.total_amount),
        amount_paid: toAmount(invoice.amount_paid),
        amount_due: invoice.amount_due == null
          ? Math.max(toAmount(invoice.total_amount) - toAmount(invoice.amount_paid), 0)
          : toAmount(invoice.amount_due),
      })),
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}