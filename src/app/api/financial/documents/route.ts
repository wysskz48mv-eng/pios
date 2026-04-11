import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { BRAND_DOCUMENT_TYPES, buildDefaultBrandSettings, getUserTenantProfile, type BrandDocumentType } from '@/lib/financial/branding'
import { calculateDocumentTotals, getDefaultStatus, normaliseDocumentItems, type DocumentItemInput } from '@/lib/financial/documents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isDocumentType(value: string): value is BrandDocumentType {
  return (BRAND_DOCUMENT_TYPES as readonly string[]).includes(value)
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, profile } = await getUserTenantProfile()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!profile) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const params = new URL(request.url).searchParams
    const documentType = params.get('document_type')?.trim() ?? null
    const status = params.get('status')?.trim() ?? null
    const search = params.get('search')?.trim().toLowerCase() ?? ''

    if (documentType && !isDocumentType(documentType)) {
      return NextResponse.json({ error: 'Invalid document_type' }, { status: 400 })
    }

    let query = supabase
      .from('documents')
      .select('id,document_type,document_number,to_name,to_email,issue_date,due_date,valid_until,total_amount,currency,status,payment_status,quote_status,proposal_status,created_at')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (documentType) query = query.eq('document_type', documentType)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error

    const documents = (data ?? []).filter((document) => {
      if (!search) return true
      return [document.document_number, document.to_name, document.to_email]
        .some((value) => String(value ?? '').toLowerCase().includes(search))
    })

    return NextResponse.json({ documents, total: documents.length })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, profile } = await getUserTenantProfile()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!profile) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const body = await request.json() as {
      document_type?: string
      template_id?: string
      to_name?: string
      to_email?: string
      to_phone?: string
      to_contact_person?: string
      to_address?: Record<string, unknown>
      issue_date?: string
      due_date?: string
      valid_until?: string
      items?: DocumentItemInput[]
      custom_fields?: Record<string, unknown>
      terms?: string
      terms_and_conditions?: string
      payment_instructions?: string
      description?: string
      currency?: string
      discount_amount?: number
      shipping_cost?: number
      notes?: string
      po_number?: string
      order_number?: string
      reference_number?: string
    }

    const documentType = String(body.document_type ?? '').trim()
    if (!isDocumentType(documentType)) {
      return NextResponse.json({ error: 'document_type must be one of invoice, quote, proposal, purchase_order, receipt' }, { status: 400 })
    }

    const items = normaliseDocumentItems(body.items ?? [])
    if (!body.to_name || !body.to_email || items.length === 0) {
      return NextResponse.json({ error: 'to_name, to_email and at least one line item are required' }, { status: 400 })
    }

    const [{ data: brandSettings, error: brandError }, { data: selectedTemplate, error: templateError }] = await Promise.all([
      supabase.from('brand_settings').select('*').eq('tenant_id', profile.tenant_id).maybeSingle(),
      body.template_id
        ? supabase.from('document_templates').select('*').eq('id', body.template_id).eq('tenant_id', profile.tenant_id).maybeSingle()
        : supabase.from('document_templates').select('*').eq('tenant_id', profile.tenant_id).eq('document_type', documentType).eq('is_default', true).maybeSingle(),
    ])

    if (brandError) throw brandError
    if (templateError) throw templateError

    const brand = brandSettings ?? buildDefaultBrandSettings(profile)
    const issueDate = body.issue_date ?? new Date().toISOString().split('T')[0]
    const dueDate = body.due_date ?? (documentType === 'invoice' ? addDays(issueDate, 30) : null)
    const validUntil = body.valid_until ?? ((documentType === 'quote' || documentType === 'proposal') ? addDays(issueDate, 30) : null)
    const totals = calculateDocumentTotals(items, Number(body.discount_amount ?? 0), Number(body.shipping_cost ?? 0))

    const rpcResult = await supabase.rpc('generate_document_number', {
      p_tenant_id: profile.tenant_id,
      p_document_type: documentType,
    })
    if (rpcResult.error) throw rpcResult.error

    const documentNumber = String(rpcResult.data ?? '').trim()
    if (!documentNumber) {
      return NextResponse.json({ error: 'Failed to generate document number' }, { status: 500 })
    }

    const insertPayload: Record<string, unknown> = {
      tenant_id: profile.tenant_id,
      user_id: user.id,
      document_type: documentType,
      document_number: documentNumber,
      template_id: selectedTemplate?.id ?? body.template_id ?? null,
      issue_date: issueDate,
      due_date: dueDate,
      valid_until: validUntil,
      from_name: brand.company_name ?? profile.organisation ?? profile.full_name ?? 'PIOS',
      from_email: brand.email_from_address ?? brand.company_email ?? user.email ?? 'noreply@veritasiq.io',
      from_address: brand.company_address ?? {},
      to_name: body.to_name,
      to_email: body.to_email,
      to_address: body.to_address ?? {},
      to_phone: body.to_phone ?? null,
      to_contact_person: body.to_contact_person ?? null,
      po_number: body.po_number ?? null,
      order_number: body.order_number ?? null,
      reference_number: body.reference_number ?? null,
      ...totals,
      currency: body.currency ?? 'GBP',
      status: getDefaultStatus(documentType),
      payment_status: documentType === 'invoice' ? 'unpaid' : null,
      quote_status: documentType === 'quote' ? 'draft' : null,
      proposal_status: documentType === 'proposal' ? 'draft' : null,
      amount_paid: 0,
      description: body.description ?? null,
      terms_and_conditions: body.terms_and_conditions ?? body.terms ?? selectedTemplate?.terms_and_conditions ?? brand.terms_and_conditions ?? null,
      payment_instructions: body.payment_instructions ?? selectedTemplate?.payment_instructions ?? null,
      notes: body.notes ?? selectedTemplate?.notes ?? null,
      custom_fields: body.custom_fields ?? {},
    }

    const { data: document, error: documentError } = await supabase
      .from('documents')
      .insert(insertPayload)
      .select('id,document_type,document_number,status,created_at')
      .single()
    if (documentError) throw documentError

    const { error: itemsError } = await supabase
      .from('document_items')
      .insert(items.map((item) => ({
        document_id: document.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        category: item.category,
        tax_rate: item.tax_rate,
        discount_percent: item.discount_percent,
        sort_order: item.sort_order,
      })))
    if (itemsError) throw itemsError

    return NextResponse.json(document, { status: 201 })
  } catch (err: unknown) {
    return apiError(err)
  }
}