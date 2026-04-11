import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { buildDefaultBrandSettings, getUserTenantProfile, resolveBrandLogoUrl } from '@/lib/financial/branding'
import {
  buildDocumentHtml,
  formatCurrency,
  formatDisplayDate,
  getDocumentLabel,
  sendDocumentEmail,
  toAmount,
  type DocumentItemRow,
  type DocumentRow,
  type DocumentTemplateRow,
} from '@/lib/financial/documents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { supabase, user, profile } = await getUserTenantProfile()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!profile) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const body = await request.json().catch(() => ({})) as {
      recipient_emails?: string[]
      subject?: string
      message?: string
    }

    const { data: document, error: documentError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
      .single<DocumentRow>()
    if (documentError) throw documentError

    const [{ data: brandData, error: brandError }, { data: items, error: itemsError }, { data: template, error: templateError }] = await Promise.all([
      supabase.from('brand_settings').select('*').eq('tenant_id', profile.tenant_id).maybeSingle(),
      supabase.from('document_items').select('*').eq('document_id', id).order('sort_order', { ascending: true }) as PromiseLike<{ data: DocumentItemRow[] | null; error: unknown }>,
      document.template_id
        ? supabase.from('document_templates').select('*').eq('id', document.template_id).eq('tenant_id', profile.tenant_id).maybeSingle<DocumentTemplateRow>()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (brandError) throw brandError
    if (itemsError) throw itemsError
    if (templateError) throw templateError

    const recipients = Array.from(new Set((body.recipient_emails ?? [document.to_email]).map((email) => String(email ?? '').trim()).filter(Boolean)))
    if (recipients.length === 0) return NextResponse.json({ error: 'At least one recipient email is required' }, { status: 400 })
    if (document.status === 'cancelled') return NextResponse.json({ error: 'Cancelled documents cannot be sent' }, { status: 409 })

    const brand = {
      ...(brandData ?? buildDefaultBrandSettings(profile)),
      logo_url: await resolveBrandLogoUrl((brandData as Record<string, unknown> | null)?.logo_url as string | null | undefined ?? (brandData as Record<string, unknown> | null)?.company_logo_url as string | null | undefined),
    }
    const html = buildDocumentHtml({
      brand,
      document,
      items: items ?? [],
      template: template ?? null,
    })

    const documentLabel = getDocumentLabel(document.document_type)
    const subject = body.subject?.trim() || `${documentLabel} ${document.document_number} from ${brand.company_name ?? document.from_name}`
    const text = [
      body.message?.trim() || `Please find attached your ${documentLabel.toLowerCase()}.`,
      `${documentLabel}: ${document.document_number}`,
      `Amount: ${formatCurrency(toAmount(document.total_amount), document.currency ?? 'GBP')}`,
      `Date: ${formatDisplayDate(document.issue_date)}`,
      document.document_type === 'invoice'
        ? `Due: ${formatDisplayDate(document.due_date)}`
        : `Valid until: ${formatDisplayDate(document.valid_until)}`,
    ].filter(Boolean).join('\n')

    const delivery = await sendDocumentEmail({
      html,
      text,
      subject,
      recipients,
      from: `${brand.email_from_name ?? brand.company_name ?? document.from_name} <${brand.email_from_address ?? document.from_email}>`,
      replyTo: brand.email_reply_to ?? document.from_email,
    })

    if (!delivery.ok) {
      return NextResponse.json({
        error: delivery.failures[0]?.result.error ?? 'Failed to send document email',
        failures: delivery.failures.map((failure) => ({ email: failure.recipient, error: failure.result.error })),
      }, { status: 502 })
    }

    const sentAt = new Date().toISOString()
    const { error: recipientsError } = await supabase
      .from('document_recipients')
      .insert(recipients.map((recipient) => ({
        document_id: id,
        recipient_email: recipient,
        recipient_name: recipient === document.to_email ? document.to_name : null,
        sent_at: sentAt,
      })))
    if (recipientsError) throw recipientsError

    const { error: updateError } = await supabase
      .from('documents')
      .update({
        status: 'sent',
        sent_at: sentAt,
        updated_at: sentAt,
        payment_status: document.document_type === 'invoice' ? (document.payment_status ?? 'unpaid') : null,
        quote_status: document.document_type === 'quote' ? 'sent' : document.quote_status,
        proposal_status: document.document_type === 'proposal' ? 'sent' : document.proposal_status,
      })
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
    if (updateError) throw updateError

    return NextResponse.json({
      sent_to: recipients,
      document_recipients: recipients.map((email) => ({ email, sent_at: sentAt })),
      subject,
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}