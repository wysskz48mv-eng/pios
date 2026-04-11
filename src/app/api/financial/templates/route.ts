import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { BRAND_DOCUMENT_TYPES, getUserTenantProfile } from '@/lib/financial/branding'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isDocumentType(value: string): value is typeof BRAND_DOCUMENT_TYPES[number] {
  return (BRAND_DOCUMENT_TYPES as readonly string[]).includes(value)
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, profile } = await getUserTenantProfile()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!profile) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const documentType = new URL(request.url).searchParams.get('document_type')?.trim() ?? null
    if (documentType && !isDocumentType(documentType)) {
      return NextResponse.json({ error: 'Invalid document_type' }, { status: 400 })
    }

    let query = supabase
      .from('document_templates')
      .select('id,tenant_id,document_type,name,description,is_default,is_system,include_fields,custom_fields,terms_and_conditions,signature_required,created_at,updated_at')
      .eq('tenant_id', profile.tenant_id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })

    if (documentType) query = query.eq('document_type', documentType)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ templates: data ?? [] })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, profile } = await getUserTenantProfile()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!profile) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const body = await request.json() as Record<string, unknown>
    const documentType = String(body.document_type ?? '').trim()
    const name = String(body.name ?? '').trim()

    if (!isDocumentType(documentType)) {
      return NextResponse.json({ error: 'document_type must be one of invoice, quote, proposal, purchase_order, receipt' }, { status: 400 })
    }
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const isDefault = Boolean(body.is_default)
    if (isDefault) {
      const { error: resetError } = await supabase
        .from('document_templates')
        .update({ is_default: false, updated_at: new Date().toISOString(), updated_by: user.id })
        .eq('tenant_id', profile.tenant_id)
        .eq('document_type', documentType)
      if (resetError) throw resetError
    }

    const { data, error } = await supabase
      .from('document_templates')
      .insert({
        tenant_id: profile.tenant_id,
        created_by: user.id,
        updated_by: user.id,
        document_type: documentType,
        name,
        description: typeof body.description === 'string' ? body.description.trim() || null : null,
        is_default: isDefault,
        is_system: false,
        header_html: typeof body.header_html === 'string' ? body.header_html : null,
        items_section_html: typeof body.items_section_html === 'string' ? body.items_section_html : null,
        totals_section_html: typeof body.totals_section_html === 'string' ? body.totals_section_html : null,
        footer_html: typeof body.footer_html === 'string' ? body.footer_html : null,
        include_fields: typeof body.include_fields === 'object' && body.include_fields !== null ? body.include_fields : {},
        custom_fields: Array.isArray(body.custom_fields) ? body.custom_fields : [],
        terms_and_conditions: typeof body.terms_and_conditions === 'string' ? body.terms_and_conditions : null,
        signature_required: Boolean(body.signature_required),
        metadata: typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : {},
      })
      .select('id,tenant_id,document_type,name,is_default,custom_fields,include_fields,created_at')
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return apiError(err)
  }
}