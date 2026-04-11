import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { sendEmail } from '@/lib/email/resend'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StoredInvoiceItem = {
  description?: string
  quantity?: number
  unit_price?: number
  category?: string
}

type InvoiceMetadata = {
  items?: StoredInvoiceItem[]
  payment_terms?: string
  metadata?: Record<string, unknown>
  description?: string | null
  sent_at?: string
  sent_to?: string
  email_delivery_id?: string
}

type InvoiceRow = {
  id: string
  user_id: string
  invoice_number: string | null
  invoice_type: string | null
  supplier_name: string | null
  supplier_email: string | null
  client_name: string | null
  client_email: string | null
  currency: string | null
  subtotal: number | string | null
  tax_amount: number | string | null
  total_amount: number | string | null
  amount_paid: number | string | null
  amount_due: number | string | null
  invoice_date: string | null
  due_date: string | null
  status: string | null
  approval_notes: string | null
  raw_text: string | null
}

function toAmount(value: unknown): number {
  return Number(value ?? 0)
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseInvoiceMeta(rawText: string | null): InvoiceMetadata {
  if (!rawText) return {}
  try {
    const parsed = JSON.parse(rawText) as InvoiceMetadata
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function formatCurrency(amount: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDisplayDate(value: string | null): string {
  if (!value) return 'Not set'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function buildInvoiceEmailHtml(input: {
  invoice: InvoiceRow
  items: StoredInvoiceItem[]
  companyName: string
  replyTo?: string | null
  paymentTerms: string
  description?: string | null
}): string {
  const { invoice, items, companyName, replyTo, paymentTerms, description } = input
  const currency = invoice.currency ?? 'GBP'
  const subtotal = toAmount(invoice.subtotal)
  const taxAmount = toAmount(invoice.tax_amount)
  const totalAmount = toAmount(invoice.total_amount)
  const itemsMarkup = items.length > 0
    ? items.map((item) => {
        const quantity = toAmount(item.quantity ?? 1)
        const unitPrice = toAmount(item.unit_price ?? 0)
        const lineTotal = quantity * unitPrice
        return `
          <tr>
            <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;color:#111827;">${escapeHtml(item.description)}</td>
            <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:right;color:#4b5563;">${escapeHtml(quantity)}</td>
            <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:right;color:#4b5563;">${escapeHtml(formatCurrency(unitPrice, currency))}</td>
            <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#111827;">${escapeHtml(formatCurrency(lineTotal, currency))}</td>
          </tr>`
      }).join('')
    : `
      <tr>
        <td colspan="4" style="padding:14px 10px;border-bottom:1px solid #e5e7eb;color:#4b5563;">Invoice details attached in the summary below.</td>
      </tr>`

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
  </head>
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;">
      <tr>
        <td style="padding:28px 32px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#f8fafc;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;opacity:0.7;">${escapeHtml(companyName)}</div>
                <div style="margin-top:8px;font-size:28px;font-weight:700;">Invoice ${escapeHtml(invoice.invoice_number ?? invoice.id)}</div>
              </td>
              <td style="text-align:right;vertical-align:top;">
                <div style="font-size:12px;opacity:0.7;">Issued</div>
                <div style="margin-top:6px;font-size:15px;font-weight:600;">${escapeHtml(formatDisplayDate(invoice.invoice_date))}</div>
                <div style="margin-top:12px;font-size:12px;opacity:0.7;">Due</div>
                <div style="margin-top:6px;font-size:15px;font-weight:600;color:#fde68a;">${escapeHtml(formatDisplayDate(invoice.due_date))}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px 8px;">
          <div style="font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#6b7280;">Bill To</div>
          <div style="margin-top:10px;font-size:18px;font-weight:600;color:#111827;">${escapeHtml(invoice.client_name ?? 'Client')}</div>
          <div style="margin-top:4px;font-size:14px;color:#4b5563;">${escapeHtml(invoice.client_email ?? '')}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 32px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:12px 10px;text-align:left;border-bottom:2px solid #cbd5e1;color:#334155;font-size:12px;letter-spacing:0.8px;text-transform:uppercase;">Description</th>
                <th style="padding:12px 10px;text-align:right;border-bottom:2px solid #cbd5e1;color:#334155;font-size:12px;letter-spacing:0.8px;text-transform:uppercase;">Qty</th>
                <th style="padding:12px 10px;text-align:right;border-bottom:2px solid #cbd5e1;color:#334155;font-size:12px;letter-spacing:0.8px;text-transform:uppercase;">Unit</th>
                <th style="padding:12px 10px;text-align:right;border-bottom:2px solid #cbd5e1;color:#334155;font-size:12px;letter-spacing:0.8px;text-transform:uppercase;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsMarkup}
            </tbody>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top;padding-right:24px;">
                ${description ? `<div style="font-size:14px;line-height:1.7;color:#374151;">${escapeHtml(description)}</div>` : ''}
                <div style="margin-top:${description ? '16px' : '0'};font-size:13px;color:#6b7280;">Payment terms: ${escapeHtml(paymentTerms)}</div>
              </td>
              <td style="width:260px;vertical-align:top;">
                <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:#4b5563;">
                  <span>Subtotal</span>
                  <strong style="color:#111827;">${escapeHtml(formatCurrency(subtotal, currency))}</strong>
                </div>
                ${taxAmount > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:#4b5563;"><span>Tax</span><strong style="color:#111827;">${escapeHtml(formatCurrency(taxAmount, currency))}</strong></div>` : ''}
                <div style="display:flex;justify-content:space-between;padding:12px 0 0;margin-top:8px;border-top:2px solid #111827;font-size:16px;">
                  <span style="font-weight:700;color:#111827;">Amount Due</span>
                  <strong style="font-weight:700;color:#111827;">${escapeHtml(formatCurrency(totalAmount, currency))}</strong>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px 28px;background:#f8fafc;border-top:1px solid #e5e7eb;">
          <div style="font-size:13px;line-height:1.7;color:#4b5563;">Thank you for your business.</div>
          ${replyTo ? `<div style="margin-top:6px;font-size:13px;color:#4b5563;">Questions: ${escapeHtml(replyTo)}</div>` : ''}
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: invoice, error: invoiceError }, { data: profile, error: profileError }] = await Promise.all([
      supabase
        .from('invoices')
        .select('id,user_id,invoice_number,invoice_type,supplier_name,supplier_email,client_name,client_email,currency,subtotal,tax_amount,total_amount,amount_paid,amount_due,invoice_date,due_date,status,approval_notes,raw_text')
        .eq('id', id)
        .eq('user_id', user.id)
        .single<InvoiceRow>(),
      supabase
        .from('user_profiles')
        .select('full_name,organisation')
        .eq('id', user.id)
        .maybeSingle<{ full_name?: string | null; organisation?: string | null }>(),
    ])

    if (invoiceError) throw invoiceError
    if (profileError) throw profileError
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (!invoice.client_email) return NextResponse.json({ error: 'Invoice is missing a recipient email' }, { status: 400 })
    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      return NextResponse.json({ error: `Cannot send invoice with status: ${invoice.status}` }, { status: 409 })
    }

    const meta = parseInvoiceMeta(invoice.raw_text)
    const companyName = invoice.supplier_name || profile?.organisation || profile?.full_name || 'PIOS'
    const senderEmail = invoice.supplier_email || user.email || process.env.RESEND_FROM_EMAIL || 'noreply@veritasiq.io'
    const senderName = companyName
    const paymentTerms = meta.payment_terms || 'Net 30'
    const items = (meta.items ?? []).filter((item) => item.description)
    const emailHtml = buildInvoiceEmailHtml({
      invoice,
      items,
      companyName,
      replyTo: invoice.supplier_email || user.email,
      paymentTerms,
      description: meta.description || invoice.approval_notes,
    })

    const sentAt = new Date().toISOString()
    const emailResult = await sendEmail({
      from: `${senderName} <${senderEmail}>`,
      to: invoice.client_email,
      replyTo: invoice.supplier_email || user.email || undefined,
      subject: `Invoice ${invoice.invoice_number ?? invoice.id} from ${companyName}`,
      html: emailHtml,
      text: [
        `Invoice ${invoice.invoice_number ?? invoice.id}`,
        `Company: ${companyName}`,
        `Amount due: ${formatCurrency(toAmount(invoice.total_amount), invoice.currency ?? 'GBP')}`,
        `Due date: ${formatDisplayDate(invoice.due_date)}`,
        `Payment terms: ${paymentTerms}`,
      ].join('\n'),
    })

    if (!emailResult.ok) {
      return NextResponse.json({ error: emailResult.error ?? 'Failed to send invoice email' }, { status: 502 })
    }

    const nextMeta: InvoiceMetadata = {
      ...meta,
      sent_at: sentAt,
      sent_to: invoice.client_email,
      email_delivery_id: emailResult.id,
    }

    const nextStatus = invoice.status === 'pending' ? 'approved' : invoice.status
    const updates: Record<string, unknown> = {
      raw_text: JSON.stringify(nextMeta),
      updated_at: sentAt,
    }
    if (nextStatus && nextStatus !== invoice.status) {
      updates.status = nextStatus
      updates.approved_at = sentAt
      updates.approved_by = user.email ?? user.id
    }

    const { error: updateError } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      message: 'Invoice sent successfully',
      invoice_id: id,
      sent_to: invoice.client_email,
      sent_at: sentAt,
      status: nextStatus,
      delivery_id: emailResult.id,
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}