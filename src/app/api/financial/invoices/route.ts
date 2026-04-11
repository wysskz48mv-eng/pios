import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type InvoiceItemInput = {
  description?: string
  quantity?: number
  unit_price?: number
  category?: string
}

function toAmount(value: unknown): number {
  return Number(value ?? 0)
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

function nextInvoiceNumber(existing: Array<{ invoice_number: string | null }>): string {
  const max = existing.reduce((highest, row) => {
    const match = row.invoice_number?.match(/(\d+)$/)
    const value = match ? Number(match[1]) : 1000
    return Math.max(highest, value)
  }, 1000)
  return `INV-${max + 1}`
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status') ?? 'all'
    const statuses = statusParam === 'all' ? [] : statusParam.split(',').map((value) => value.trim()).filter(Boolean)
    const search = (searchParams.get('search') ?? '').trim().toLowerCase()
    const minAmount = Number(searchParams.get('min_amount') ?? 0)
    const dateRange = (searchParams.get('date_range') ?? '').split(',')
    const [dateStart, dateEnd] = dateRange

    const { data, error } = await supabase
      .from('invoices')
      .select('id,invoice_number,invoice_type,supplier_name,supplier_email,client_name,client_email,currency,subtotal,tax_amount,total_amount,amount_paid,amount_due,invoice_date,due_date,paid_date,status,approval_notes,created_at,updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) throw error

    const invoices = (data ?? []).filter((invoice) => {
      const matchesStatus = statuses.length === 0 || statuses.includes(String(invoice.status ?? ''))
      const matchesAmount = Number(invoice.total_amount ?? 0) >= minAmount
      const matchesSearch = !search || [
        invoice.invoice_number,
        invoice.client_name,
        invoice.client_email,
        invoice.supplier_name,
        invoice.supplier_email,
      ].some((value) => String(value ?? '').toLowerCase().includes(search))
      const invoiceDate = String(invoice.invoice_date ?? '')
      const matchesDateStart = !dateStart || invoiceDate >= dateStart
      const matchesDateEnd = !dateEnd || invoiceDate <= dateEnd
      return matchesStatus && matchesAmount && matchesSearch && matchesDateStart && matchesDateEnd
    })

    return NextResponse.json({
      invoices: invoices.map((invoice) => ({
        ...invoice,
        subtotal: toAmount(invoice.subtotal),
        tax_amount: toAmount(invoice.tax_amount),
        total_amount: toAmount(invoice.total_amount),
        amount_paid: toAmount(invoice.amount_paid),
        amount_due: invoice.amount_due == null
          ? Math.max(toAmount(invoice.total_amount) - toAmount(invoice.amount_paid), 0)
          : toAmount(invoice.amount_due),
      })),
      total: invoices.length,
      pagination: { page: 1, page_size: invoices.length, total: invoices.length },
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
      to_name?: string
      to_email?: string
      items?: InvoiceItemInput[]
      payment_terms?: string
      metadata?: Record<string, unknown>
      due_date?: string
      description?: string
      invoice_type?: string
      tax_rate?: number
    }

    const items = (body.items ?? []).filter((item) => item.description && toAmount(item.quantity ?? 1) > 0)
    if (!body.to_name || !body.to_email || items.length === 0) {
      return NextResponse.json({ error: 'to_name, to_email and at least one invoice item are required' }, { status: 400 })
    }

    const [{ data: profile, error: profileError }, { data: existing, error: existingError }] = await Promise.all([
      supabase.from('user_profiles').select('full_name,organisation').eq('id', user.id).single(),
      supabase.from('invoices').select('invoice_number').eq('user_id', user.id).not('invoice_number', 'is', null).order('created_at', { ascending: false }).limit(25),
    ])

    if (profileError) throw profileError
    if (existingError) throw existingError

    const subtotal = items.reduce((sum, item) => sum + (toAmount(item.quantity ?? 1) * toAmount(item.unit_price ?? 0)), 0)
    const taxRate = toAmount(body.tax_rate ?? 0)
    const taxAmount = subtotal * (taxRate / 100)
    const totalAmount = subtotal + taxAmount
    const invoiceDate = new Date().toISOString().split('T')[0]
    const dueDate = body.due_date ?? addDays(invoiceDate, 30)
    const invoiceNumber = nextInvoiceNumber((existing ?? []) as Array<{ invoice_number: string | null }>)
    const invoiceMeta = {
      items,
      payment_terms: body.payment_terms ?? 'Net 30',
      metadata: body.metadata ?? {},
      description: body.description ?? null,
      source: 'financial_intelligence_ui',
    }

    const { data, error } = await supabase.from('invoices').insert({
      user_id: user.id,
      invoice_number: invoiceNumber,
      invoice_type: body.invoice_type ?? 'receivable',
      supplier_name: (profile as { organisation?: string | null; full_name?: string | null } | null)?.organisation
        ?? (profile as { full_name?: string | null } | null)?.full_name
        ?? 'PIOS',
      supplier_email: user.email,
      client_name: body.to_name,
      client_email: body.to_email,
      currency: 'GBP',
      subtotal: Number(subtotal.toFixed(2)),
      tax_amount: Number(taxAmount.toFixed(2)),
      total_amount: Number(totalAmount.toFixed(2)),
      amount_paid: 0,
      amount_due: Number(totalAmount.toFixed(2)),
      invoice_date: invoiceDate,
      due_date: dueDate,
      status: 'pending',
      approval_notes: body.description ?? null,
      raw_text: JSON.stringify(invoiceMeta),
      ai_extracted: false,
    }).select('id,invoice_number,status,total_amount,created_at').single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return apiError(err)
  }
}