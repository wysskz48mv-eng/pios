import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PaymentHistoryEntry = {
  amount?: number
  payment_date?: string
  recorded_at?: string
  note?: string | null
  recorded_by?: string | null
}

type InvoiceMeta = {
  payment_history?: PaymentHistoryEntry[]
}

type InvoiceRow = {
  id: string
  user_id: string
  invoice_number: string | null
  client_name: string | null
  client_email: string | null
  supplier_name: string | null
  supplier_email: string | null
  currency: string | null
  subtotal: number | string | null
  tax_amount: number | string | null
  total_amount: number | string | null
  amount_paid: number | string | null
  amount_due: number | string | null
  invoice_date: string | null
  due_date: string | null
  paid_date: string | null
  status: string | null
  raw_text: string | null
  updated_at: string | null
}

function toAmount(value: unknown): number {
  return Number(value ?? 0)
}

function parseMeta(rawText: string | null): InvoiceMeta {
  if (!rawText) return {}
  try {
    const parsed = JSON.parse(rawText) as InvoiceMeta
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function buildDerivedPaymentStatus(invoice: InvoiceRow): 'unpaid' | 'partial' | 'paid' | 'overdue' {
  const total = toAmount(invoice.total_amount)
  const paid = toAmount(invoice.amount_paid)
  const due = invoice.amount_due == null ? Math.max(total - paid, 0) : toAmount(invoice.amount_due)
  const today = new Date()
  const dueDate = invoice.due_date ? new Date(invoice.due_date) : null

  if (due <= 0 || invoice.status === 'paid') return 'paid'
  if (paid > 0) return 'partial'
  if (dueDate && dueDate < today) return 'overdue'
  return 'unpaid'
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoice_id')
    const statusFilter = (searchParams.get('status') ?? '').trim().toLowerCase()

    let query = supabase
      .from('invoices')
      .select('id,user_id,invoice_number,client_name,client_email,supplier_name,supplier_email,currency,subtotal,tax_amount,total_amount,amount_paid,amount_due,invoice_date,due_date,paid_date,status,raw_text,updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(200)

    if (invoiceId) query = query.eq('id', invoiceId)

    const { data, error } = await query
    if (error) throw error

    const payments = (data ?? []).map((invoice) => {
      const typedInvoice = invoice as InvoiceRow
      const total = toAmount(typedInvoice.total_amount)
      const paid = toAmount(typedInvoice.amount_paid)
      const due = typedInvoice.amount_due == null ? Math.max(total - paid, 0) : toAmount(typedInvoice.amount_due)
      const meta = parseMeta(typedInvoice.raw_text)
      return {
        id: typedInvoice.id,
        invoice_id: typedInvoice.id,
        invoice_number: typedInvoice.invoice_number,
        client_name: typedInvoice.client_name,
        client_email: typedInvoice.client_email,
        supplier_name: typedInvoice.supplier_name,
        currency: typedInvoice.currency ?? 'GBP',
        total_amount: total,
        amount_paid: paid,
        amount_due: due,
        payment_status: buildDerivedPaymentStatus(typedInvoice),
        paid_date: typedInvoice.paid_date,
        due_date: typedInvoice.due_date,
        invoice_date: typedInvoice.invoice_date,
        updated_at: typedInvoice.updated_at,
        payment_history: meta.payment_history ?? [],
      }
    }).filter((payment) => !statusFilter || payment.payment_status === statusFilter)

    const summary = payments.reduce((acc, payment) => {
      acc.total_received += payment.amount_paid
      acc.total_outstanding += payment.amount_due
      if (payment.payment_status === 'paid') acc.paid_count += 1
      if (payment.payment_status === 'partial') acc.partial_count += 1
      if (payment.payment_status === 'overdue') acc.overdue_count += 1
      return acc
    }, {
      total_received: 0,
      total_outstanding: 0,
      paid_count: 0,
      partial_count: 0,
      overdue_count: 0,
    })

    return NextResponse.json({
      payments,
      total: payments.length,
      summary,
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as {
      invoice_id?: string
      amount?: number
      payment_date?: string
      note?: string
    }

    const invoiceId = String(body.invoice_id ?? '').trim()
    const paymentAmount = toAmount(body.amount)
    const paymentDate = String(body.payment_date ?? new Date().toISOString().split('T')[0])
    const note = String(body.note ?? '').trim() || null

    if (!invoiceId || paymentAmount <= 0) {
      return NextResponse.json({ error: 'invoice_id and a positive amount are required' }, { status: 400 })
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id,user_id,invoice_number,client_name,client_email,supplier_name,supplier_email,currency,subtotal,tax_amount,total_amount,amount_paid,amount_due,invoice_date,due_date,paid_date,status,raw_text,updated_at')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single<InvoiceRow>()

    if (invoiceError) throw invoiceError
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    const total = toAmount(invoice.total_amount)
    const currentPaid = toAmount(invoice.amount_paid)
    const nextPaid = Number((currentPaid + paymentAmount).toFixed(2))
    if (nextPaid - total > 0.0001) {
      return NextResponse.json({ error: 'Payment amount exceeds outstanding balance' }, { status: 409 })
    }

    const nextDue = Number(Math.max(total - nextPaid, 0).toFixed(2))
    const meta = parseMeta(invoice.raw_text)
    const paymentHistory = [
      ...(meta.payment_history ?? []),
      {
        amount: paymentAmount,
        payment_date: paymentDate,
        recorded_at: new Date().toISOString(),
        note,
        recorded_by: user.email ?? user.id,
      },
    ]

    const nextStatus = nextDue <= 0
      ? 'paid'
      : invoice.status === 'pending'
        ? 'approved'
        : (invoice.status ?? 'approved')

    const updates: Record<string, unknown> = {
      amount_paid: nextPaid,
      amount_due: nextDue,
      status: nextStatus,
      updated_at: new Date().toISOString(),
      raw_text: JSON.stringify({
        ...meta,
        payment_history: paymentHistory,
      }),
    }
    if (nextDue <= 0) updates.paid_date = paymentDate

    const { data: updated, error: updateError } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .select('id,invoice_number,client_name,client_email,currency,total_amount,amount_paid,amount_due,paid_date,status,updated_at')
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      payment: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        amount: paymentAmount,
        payment_date: paymentDate,
        note,
        recorded_by: user.email ?? user.id,
      },
      invoice: updated,
    }, { status: 201 })
  } catch (err: unknown) {
    return apiError(err)
  }
}