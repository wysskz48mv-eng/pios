import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function toAmount(value: unknown): number {
  return Number(value ?? 0)
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) throw error
    return NextResponse.json({
      ...data,
      subtotal: toAmount(data?.subtotal),
      tax_amount: toAmount(data?.tax_amount),
      total_amount: toAmount(data?.total_amount),
      amount_paid: toAmount(data?.amount_paid),
      amount_due: data?.amount_due == null
        ? Math.max(toAmount(data?.total_amount) - toAmount(data?.amount_paid), 0)
        : toAmount(data?.amount_due),
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as Record<string, unknown>
    const { data: current, error: currentError } = await supabase
      .from('invoices')
      .select('id,status,total_amount,amount_paid,raw_text')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (currentError) throw currentError
    if (current.status !== 'pending' && Object.keys(body).some((key) => key !== 'status' && key !== 'amount_paid')) {
      return NextResponse.json({ error: 'Only pending invoices can be edited' }, { status: 409 })
    }

    const nextTotal = body.total_amount == null ? toAmount(current.total_amount) : toAmount(body.total_amount)
    const nextPaid = body.amount_paid == null ? toAmount(current.amount_paid) : toAmount(body.amount_paid)
    const nextStatus = String(body.status ?? current.status)
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      amount_due: Math.max(nextTotal - nextPaid, 0),
    }

    for (const field of ['client_name', 'client_email', 'supplier_name', 'supplier_email', 'invoice_type', 'invoice_date', 'due_date', 'approval_notes']) {
      if (body[field] !== undefined) updates[field] = body[field]
    }
    for (const field of ['subtotal', 'tax_amount', 'total_amount', 'amount_paid']) {
      if (body[field] !== undefined) updates[field] = toAmount(body[field])
    }
    if (body.status !== undefined) updates.status = nextStatus
    if (nextStatus === 'paid') updates.paid_date = new Date().toISOString().split('T')[0]
    if (body.raw_text !== undefined) updates.raw_text = body.raw_text

    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: unknown) {
    return apiError(err)
  }
}