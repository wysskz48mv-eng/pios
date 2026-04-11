import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { getUserTenantProfile } from '@/lib/financial/branding'
import type { DocumentRow } from '@/lib/financial/documents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) return null
  return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') }
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { supabase, user, profile } = await getUserTenantProfile()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!profile) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const { data, error } = await supabase
      .from('document_signatures')
      .select('*')
      .eq('document_id', id)
      .order('created_at', { ascending: true })
    if (error) throw error

    return NextResponse.json({ signatures: data ?? [] })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { supabase, user, profile } = await getUserTenantProfile()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!profile) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const body = await request.json() as {
      signer_name?: string
      signer_email?: string
      signer_title?: string
      signature_url?: string
      signature_data_url?: string
    }

    const { data: document, error: documentError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
      .single<DocumentRow>()
    if (documentError) throw documentError

    if (!body.signer_name || !body.signer_email) {
      return NextResponse.json({ error: 'signer_name and signer_email are required' }, { status: 400 })
    }

    let signatureUrl = body.signature_url ?? null
    if (!signatureUrl && body.signature_data_url) {
      const decoded = decodeDataUrl(body.signature_data_url)
      if (!decoded) {
        return NextResponse.json({ error: 'Invalid signature_data_url' }, { status: 400 })
      }
      const extension = decoded.mimeType.split('/')[1] ?? 'png'
      const path = `${profile.tenant_id}/documents/signatures/${id}-${Date.now()}.${extension}`
      const { error: uploadError } = await (supabase as any)
        .storage.from('pios-files')
        .upload(path, decoded.buffer, { contentType: decoded.mimeType, upsert: true })
      if (uploadError) throw uploadError
      signatureUrl = path
    }

    const signedAt = new Date().toISOString()
    const { data, error } = await supabase
      .from('document_signatures')
      .insert({
        document_id: id,
        signer_name: body.signer_name,
        signer_email: body.signer_email,
        signer_title: body.signer_title ?? null,
        signature_url: signatureUrl,
        signature_date: signedAt.split('T')[0],
        ip_address: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
        user_agent: request.headers.get('user-agent'),
        signed_at: signedAt,
      })
      .select('*')
      .single()
    if (error) throw error

    const documentUpdates: Record<string, unknown> = {
      updated_at: signedAt,
      accepted_at: signedAt,
    }
    if (document.document_type === 'proposal') {
      documentUpdates.status = 'sent'
      documentUpdates.proposal_status = 'approved'
    }

    const { error: updateError } = await supabase
      .from('documents')
      .update(documentUpdates)
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
    if (updateError) throw updateError

    return NextResponse.json({ success: true, signature: data })
  } catch (err: unknown) {
    return apiError(err)
  }
}