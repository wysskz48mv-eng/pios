import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { getUserTenantProfile } from '@/lib/financial/branding'
import {
  buildDocumentText,
  calculateDocumentTotals,
  normaliseDocumentItems,
  toAmount,
  type DocumentItemInput,
  type DocumentItemRow,
  type DocumentRow,
  type DocumentTemplateRow,
  type DocumentUpdateBody,
} from '@/lib/financial/documents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type UserTenantProfile = Awaited<ReturnType<typeof getUserTenantProfile>>

async function loadDocumentBundle(supabase: UserTenantProfile['supabase'], tenantId: string, id: string) {
  const { data: document, error: documentError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single<DocumentRow>()
  if (documentError) throw documentError

  const [{ data: items, error: itemsError }, { data: recipients, error: recipientsError }, { data: signatures, error: signaturesError }, { data: pdf, error: pdfError }, { data: template, error: templateError }] = await Promise.all([
    supabase.from('document_items').select('*').eq('document_id', id).order('sort_order', { ascending: true }) as PromiseLike<{ data: DocumentItemRow[] | null; error: unknown }>,
    supabase.from('document_recipients').select('*').eq('document_id', id).order('created_at', { ascending: true }),
    supabase.from('document_signatures').select('*').eq('document_id', id).order('created_at', { ascending: true }),
    supabase.from('document_pdfs').select('*').eq('document_id', id).maybeSingle(),
    document.template_id
      ? supabase.from('document_templates').select('*').eq('id', document.template_id).eq('tenant_id', tenantId).maybeSingle<DocumentTemplateRow>()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (itemsError) throw itemsError
  if (recipientsError) throw recipientsError
  if (signaturesError) throw signaturesError
  if (pdfError) throw pdfError
  if (templateError) throw templateError

  return {
    document,
    items: items ?? [],
    recipients: recipients ?? [],
    signatures: signatures ?? [],
    pdf: pdf ?? null,
    template: template ?? null,
  }
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { supabase, user, profile } = await getUserTenantProfile()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!profile) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const bundle = await loadDocumentBundle(supabase, profile.tenant_id, id)
    return NextResponse.json({
      ...bundle.document,
      subtotal: toAmount(bundle.document.subtotal),
      discount_amount: toAmount(bundle.document.discount_amount),
      tax_amount: toAmount(bundle.document.tax_amount),
      shipping_cost: toAmount(bundle.document.shipping_cost),
      total_amount: toAmount(bundle.document.total_amount),
      amount_paid: toAmount(bundle.document.amount_paid),
      items: bundle.items.map((item) => ({
        ...item,
        quantity: toAmount(item.quantity),
        unit_price: toAmount(item.unit_price),
        line_total: toAmount(item.line_total),
        tax_rate: toAmount(item.tax_rate),
        discount_percent: toAmount(item.discount_percent),
      })),
      recipients: bundle.recipients,
      signatures: bundle.signatures,
      pdf: bundle.pdf,
      template: bundle.template,
      text_preview: buildDocumentText({
        brand: { tenant_id: profile.tenant_id },
        document: bundle.document,
        items: bundle.items,
        template: bundle.template,
      }),
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { supabase, user, profile } = await getUserTenantProfile()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!profile) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const body = await request.json() as DocumentUpdateBody
    const bundle = await loadDocumentBundle(supabase, profile.tenant_id, id)

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of [
      'to_name', 'to_email', 'to_phone', 'to_contact_person', 'to_address', 'issue_date', 'due_date', 'valid_until',
      'description', 'terms_and_conditions', 'payment_instructions', 'notes', 'custom_fields', 'currency',
      'po_number', 'order_number', 'reference_number', 'status', 'payment_status', 'quote_status', 'proposal_status',
    ] as const) {
      if (body[field] !== undefined) updates[field] = body[field]
    }

    let items = bundle.items
    if (body.items !== undefined) {
      items = normaliseDocumentItems(body.items as DocumentItemInput[])
      if (items.length === 0) {
        return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 })
      }

      const { error: deleteError } = await supabase.from('document_items').delete().eq('document_id', id)
      if (deleteError) throw deleteError

      const { error: insertError } = await supabase.from('document_items').insert(items.map((item) => ({
        document_id: id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        category: item.category,
        tax_rate: item.tax_rate,
        discount_percent: item.discount_percent,
        sort_order: item.sort_order,
      })))
      if (insertError) throw insertError
    }

    const totals = calculateDocumentTotals(
      items,
      Number(body.discount_amount ?? bundle.document.discount_amount ?? 0),
      Number(body.shipping_cost ?? bundle.document.shipping_cost ?? 0),
    )
    updates.subtotal = totals.subtotal
    updates.tax_amount = totals.tax_amount
    updates.discount_amount = totals.discount_amount
    updates.shipping_cost = totals.shipping_cost
    updates.total_amount = totals.total_amount

    const amountPaid = body.amount_paid === undefined ? toAmount(bundle.document.amount_paid) : Number(body.amount_paid)
    updates.amount_paid = Math.max(amountPaid, 0)
    if (bundle.document.document_type === 'invoice') {
      updates.payment_status = body.payment_status ?? (amountPaid > 0
        ? amountPaid >= totals.total_amount ? 'paid' : 'partial'
        : bundle.document.payment_status ?? 'unpaid')
    }

    const { data, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
      .select('*')
      .single<DocumentRow>()
    if (error) throw error

    return NextResponse.json(data)
  } catch (err: unknown) {
    return apiError(err)
  }
}