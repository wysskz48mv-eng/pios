import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { BRAND_DOCUMENT_TYPES, getUserTenantProfile } from '@/lib/financial/branding'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isDocumentType(value: string): value is typeof BRAND_DOCUMENT_TYPES[number] {
  return (BRAND_DOCUMENT_TYPES as readonly string[]).includes(value)
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { supabase, user, profile } = await getUserTenantProfile()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!profile) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const body = await request.json() as Record<string, unknown>
    const { data: current, error: currentError } = await supabase
      .from('document_templates')
      .select('id,tenant_id,document_type,is_system')
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
      .single<{ id: string; tenant_id: string; document_type: string; is_system?: boolean | null }>()
    if (currentError) throw currentError

    const nextType = body.document_type == null ? current.document_type : String(body.document_type).trim()
    if (!isDocumentType(nextType)) {
      return NextResponse.json({ error: 'Invalid document_type' }, { status: 400 })
    }

    const isDefault = body.is_default == null ? undefined : Boolean(body.is_default)
    if (isDefault) {
      const { error: resetError } = await supabase
        .from('document_templates')
        .update({ is_default: false, updated_at: new Date().toISOString(), updated_by: user.id })
        .eq('tenant_id', profile.tenant_id)
        .eq('document_type', nextType)
      if (resetError) throw resetError
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }

    for (const field of ['name', 'description', 'header_html', 'items_section_html', 'totals_section_html', 'footer_html', 'terms_and_conditions', 'payment_instructions', 'notes'] as const) {
      if (body[field] !== undefined) updates[field] = typeof body[field] === 'string' ? String(body[field]) : body[field]
    }
    if (body.document_type !== undefined) updates.document_type = nextType
    if (body.include_fields !== undefined) updates.include_fields = typeof body.include_fields === 'object' && body.include_fields !== null ? body.include_fields : {}
    if (body.custom_fields !== undefined) updates.custom_fields = Array.isArray(body.custom_fields) ? body.custom_fields : []
    if (body.signature_required !== undefined) updates.signature_required = Boolean(body.signature_required)
    if (body.is_default !== undefined) updates.is_default = isDefault

    const { data, error } = await supabase
      .from('document_templates')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
      .select('*')
      .single()
    if (error) throw error

    return NextResponse.json(data)
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { supabase, user, profile } = await getUserTenantProfile()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!profile) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const { data: current, error: currentError } = await supabase
      .from('document_templates')
      .select('id,is_system,is_default')
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
      .single<{ id: string; is_system?: boolean | null; is_default?: boolean | null }>()
    if (currentError) throw currentError
    if (current.is_system) {
      return NextResponse.json({ error: 'System templates cannot be deleted' }, { status: 409 })
    }

    const { error } = await supabase
      .from('document_templates')
      .delete()
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return apiError(err)
  }
}