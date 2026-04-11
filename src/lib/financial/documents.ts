import { sendEmail } from '@/lib/email/resend'
import { buildDefaultBrandSettings, type BrandDocumentType, type BrandSettingsRecord } from '@/lib/financial/branding'

export type DocumentItemInput = {
  description?: string
  quantity?: number
  unit_price?: number
  tax_rate?: number
  discount_percent?: number
  category?: string
  sort_order?: number
}

export type DocumentRow = {
  id: string
  tenant_id: string
  user_id?: string | null
  document_type: BrandDocumentType
  document_number: string
  template_id?: string | null
  issue_date: string | null
  due_date?: string | null
  valid_until?: string | null
  from_name: string
  from_email: string
  from_address?: Record<string, unknown> | null
  to_name: string
  to_email: string
  to_address?: Record<string, unknown> | null
  to_phone?: string | null
  to_contact_person?: string | null
  po_number?: string | null
  order_number?: string | null
  reference_number?: string | null
  subtotal: number | string | null
  discount_amount: number | string | null
  tax_amount: number | string | null
  shipping_cost: number | string | null
  total_amount: number | string | null
  currency?: string | null
  status?: string | null
  payment_status?: string | null
  quote_status?: string | null
  proposal_status?: string | null
  amount_paid?: number | string | null
  description?: string | null
  terms_and_conditions?: string | null
  payment_instructions?: string | null
  notes?: string | null
  custom_fields?: Record<string, unknown> | null
  sent_at?: string | null
  viewed_at?: string | null
  accepted_at?: string | null
  declined_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type DocumentTemplateRow = {
  id: string
  tenant_id: string
  document_type: BrandDocumentType
  name: string
  description?: string | null
  is_default?: boolean | null
  is_system?: boolean | null
  header_html?: string | null
  items_section_html?: string | null
  totals_section_html?: string | null
  footer_html?: string | null
  include_fields?: Record<string, unknown> | null
  custom_fields?: Array<Record<string, unknown>> | null
  terms_and_conditions?: string | null
  payment_instructions?: string | null
  notes?: string | null
  signature_required?: boolean | null
}

export type DocumentItemRow = {
  id?: string
  document_id?: string
  description: string
  quantity: number
  unit_price: number
  line_total?: number | string | null
  category?: string | null
  tax_rate?: number | null
  discount_percent?: number | null
  sort_order?: number | null
}

export type DocumentRenderContext = {
  brand: BrandSettingsRecord
  document: DocumentRow
  items: DocumentItemRow[]
  template: DocumentTemplateRow | null
}

export function toAmount(value: unknown): number {
  return Number(value ?? 0)
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatCurrency(amount: number, currency = 'GBP'): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export function formatDisplayDate(value: string | null | undefined): string {
  if (!value) return 'Not set'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function getDocumentLabel(documentType: BrandDocumentType): string {
  switch (documentType) {
    case 'invoice': return 'Invoice'
    case 'quote': return 'Quote'
    case 'proposal': return 'Proposal'
    case 'purchase_order': return 'Purchase Order'
    case 'receipt': return 'Receipt'
  }
}

export function getDefaultStatus(documentType: BrandDocumentType): string {
  switch (documentType) {
    case 'quote':
    case 'proposal':
    case 'purchase_order':
    case 'receipt':
    case 'invoice':
      return 'draft'
  }
}

export function normaliseDocumentItems(items: DocumentItemInput[]): DocumentItemRow[] {
  return items
    .filter((item) => item.description && toAmount(item.quantity ?? 1) > 0)
    .map((item, index) => ({
      description: String(item.description ?? '').trim(),
      quantity: toAmount(item.quantity ?? 1),
      unit_price: toAmount(item.unit_price ?? 0),
      tax_rate: toAmount(item.tax_rate ?? 0),
      discount_percent: toAmount(item.discount_percent ?? 0),
      category: item.category?.trim() || null,
      sort_order: item.sort_order ?? index,
    }))
}

export function calculateDocumentTotals(items: DocumentItemRow[], discountAmount = 0, shippingCost = 0) {
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  const taxAmount = items.reduce((sum, item) => {
    const lineTotal = item.quantity * item.unit_price
    const lineDiscount = lineTotal * (toAmount(item.discount_percent) / 100)
    const taxableBase = Math.max(lineTotal - lineDiscount, 0)
    return sum + taxableBase * (toAmount(item.tax_rate) / 100)
  }, 0)
  const totalAmount = Math.max(subtotal - discountAmount + taxAmount + shippingCost, 0)
  return {
    subtotal: Number(subtotal.toFixed(2)),
    tax_amount: Number(taxAmount.toFixed(2)),
    discount_amount: Number(discountAmount.toFixed(2)),
    shipping_cost: Number(shippingCost.toFixed(2)),
    total_amount: Number(totalAmount.toFixed(2)),
  }
}

function renderTemplate(template: string | null | undefined, variables: Record<string, string>, fallback: string): string {
  if (!template) return fallback
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => variables[key] ?? '')
}

function renderAddressBlock(address: Record<string, unknown> | null | undefined): string {
  if (!address || typeof address !== 'object') return ''
  const parts = ['street', 'city', 'state', 'zip', 'country']
    .map((key) => escapeHtml(address[key]))
    .filter(Boolean)
  return parts.length ? `<div style="margin-top:6px;color:#4b5563;font-size:13px;line-height:1.6;">${parts.join('<br/>')}</div>` : ''
}

export function buildDocumentHtml(context: DocumentRenderContext): string {
  const { brand, document, items, template } = context
  const defaults = buildDefaultBrandSettings({
    tenant_id: document.tenant_id,
    organisation: document.from_name,
    full_name: document.from_name,
    email: document.from_email,
  })
  const primary = brand.primary_color ?? defaults.primary_color ?? '#0f4c81'
  const secondary = brand.secondary_color ?? defaults.secondary_color ?? '#6b7280'
  const accent = brand.accent_color ?? defaults.accent_color ?? '#d97706'
  const background = brand.background_color ?? '#ffffff'
  const textColor = brand.text_color ?? '#333333'
  const fontFamily = brand.font_family ?? 'system-ui'
  const headingFont = brand.heading_font ?? fontFamily
  const currency = document.currency ?? 'GBP'
  const subtotal = toAmount(document.subtotal)
  const taxAmount = toAmount(document.tax_amount)
  const discountAmount = toAmount(document.discount_amount)
  const shippingCost = toAmount(document.shipping_cost)
  const totalAmount = toAmount(document.total_amount)
  const documentLabel = getDocumentLabel(document.document_type)
  const itemsRows = items.length > 0
    ? items.map((item) => {
        const lineTotal = item.line_total == null ? item.quantity * item.unit_price : toAmount(item.line_total)
        return `
          <tr>
            <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;color:${textColor};">${escapeHtml(item.description)}</td>
            <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:right;color:${secondary};">${escapeHtml(item.quantity)}</td>
            <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:right;color:${secondary};">${escapeHtml(formatCurrency(item.unit_price, currency))}</td>
            <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:${textColor};">${escapeHtml(formatCurrency(lineTotal, currency))}</td>
          </tr>`
      }).join('')
    : `<tr><td colspan="4" style="padding:14px 10px;color:${secondary};">No line items available.</td></tr>`

  const totalsMarkup = [
    { label: 'Subtotal', value: formatCurrency(subtotal, currency) },
    discountAmount > 0 ? { label: 'Discount', value: `-${formatCurrency(discountAmount, currency)}` } : null,
    taxAmount > 0 ? { label: 'Tax', value: formatCurrency(taxAmount, currency) } : null,
    shippingCost > 0 ? { label: 'Shipping', value: formatCurrency(shippingCost, currency) } : null,
    { label: 'Total', value: formatCurrency(totalAmount, currency), strong: true },
  ].filter(Boolean).map((row) => {
    const typed = row as { label: string; value: string; strong?: boolean }
    return `<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:${typed.strong ? '16px' : '14px'};color:${typed.strong ? textColor : secondary};font-weight:${typed.strong ? '700' : '500'};"><span>${escapeHtml(typed.label)}</span><span>${escapeHtml(typed.value)}</span></div>`
  }).join('')

  const variables: Record<string, string> = {
    company_name: escapeHtml(brand.company_name ?? document.from_name),
    document_label: escapeHtml(documentLabel),
    document_number: escapeHtml(document.document_number),
    issue_date: escapeHtml(formatDisplayDate(document.issue_date)),
    due_date: escapeHtml(formatDisplayDate(document.due_date ?? document.valid_until)),
    to_name: escapeHtml(document.to_name),
    to_email: escapeHtml(document.to_email),
    from_name: escapeHtml(document.from_name),
    from_email: escapeHtml(document.from_email),
    items_rows: itemsRows,
    totals: totalsMarkup,
    legal_footer: escapeHtml(brand.legal_footer ?? brand.footer_text ?? 'Thank you for your business.'),
    payment_instructions: escapeHtml(document.payment_instructions ?? template?.payment_instructions ?? ''),
    terms_and_conditions: escapeHtml(document.terms_and_conditions ?? template?.terms_and_conditions ?? ''),
  }

  const headerFallback = `
    <div style="display:flex;justify-content:space-between;gap:24px;align-items:flex-start;">
      <div>
        <div style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:${secondary};">${escapeHtml(brand.company_name ?? document.from_name)}</div>
        <div style="margin-top:8px;font-size:28px;font-weight:700;color:${textColor};font-family:${headingFont};">${escapeHtml(documentLabel)} ${escapeHtml(document.document_number)}</div>
      </div>
      <div style="text-align:right;min-width:180px;">
        <div style="font-size:12px;color:${secondary};">Issued</div>
        <div style="margin-top:6px;font-size:15px;font-weight:600;color:${textColor};">${escapeHtml(formatDisplayDate(document.issue_date))}</div>
        <div style="margin-top:12px;font-size:12px;color:${secondary};">${document.document_type === 'invoice' ? 'Due' : 'Valid until'}</div>
        <div style="margin-top:6px;font-size:15px;font-weight:600;color:${accent};">${escapeHtml(formatDisplayDate(document.due_date ?? document.valid_until))}</div>
      </div>
    </div>`

  const itemsFallback = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:12px 10px;text-align:left;border-bottom:2px solid #cbd5e1;color:${secondary};font-size:12px;letter-spacing:0.8px;text-transform:uppercase;">Description</th>
          <th style="padding:12px 10px;text-align:right;border-bottom:2px solid #cbd5e1;color:${secondary};font-size:12px;letter-spacing:0.8px;text-transform:uppercase;">Qty</th>
          <th style="padding:12px 10px;text-align:right;border-bottom:2px solid #cbd5e1;color:${secondary};font-size:12px;letter-spacing:0.8px;text-transform:uppercase;">Unit</th>
          <th style="padding:12px 10px;text-align:right;border-bottom:2px solid #cbd5e1;color:${secondary};font-size:12px;letter-spacing:0.8px;text-transform:uppercase;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>`

  const totalsFallback = `<div style="min-width:240px;">${totalsMarkup}</div>`
  const footerFallback = `<div style="font-size:13px;line-height:1.7;color:${secondary};">${escapeHtml(brand.footer_text ?? brand.legal_footer ?? 'Thank you for your business.')}</div>`

  const companyLogo = brand.logo_url || brand.company_logo_url

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      :root {
        --primary: ${primary};
        --secondary: ${secondary};
        --accent: ${accent};
        --background: ${background};
        --text: ${textColor};
      }
      body { margin: 0; padding: 24px; background: #eef2f7; color: var(--text); font-family: ${fontFamily}; }
    </style>
  </head>
  <body>
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:840px;margin:0 auto;background:${background};border:1px solid #dbe4ee;border-radius:20px;overflow:hidden;">
      <tr>
        <td style="padding:28px 32px;border-bottom:1px solid #e5e7eb;">
          ${companyLogo ? `<img src="${escapeHtml(companyLogo)}" alt="logo" style="max-width:${escapeHtml(brand.logo_width ?? 200)}px;max-height:${escapeHtml(brand.logo_height ?? 60)}px;display:block;margin-bottom:16px;" />` : ''}
          ${renderTemplate(template?.header_html, variables, headerFallback)}
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px 8px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
            <div>
              <div style="font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${secondary};">From</div>
              <div style="margin-top:8px;font-size:16px;font-weight:600;color:${textColor};">${escapeHtml(document.from_name)}</div>
              <div style="margin-top:4px;font-size:13px;color:${secondary};">${escapeHtml(document.from_email)}</div>
              ${renderAddressBlock(document.from_address)}
            </div>
            <div>
              <div style="font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${secondary};">To</div>
              <div style="margin-top:8px;font-size:16px;font-weight:600;color:${textColor};">${escapeHtml(document.to_name)}</div>
              <div style="margin-top:4px;font-size:13px;color:${secondary};">${escapeHtml(document.to_email)}</div>
              ${document.to_contact_person ? `<div style="margin-top:4px;font-size:13px;color:${secondary};">Contact: ${escapeHtml(document.to_contact_person)}</div>` : ''}
              ${renderAddressBlock(document.to_address)}
            </div>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px 0;">${renderTemplate(template?.items_section_html, variables, itemsFallback)}</td>
      </tr>
      <tr>
        <td style="padding:24px 32px;">
          <div style="display:flex;justify-content:space-between;gap:24px;align-items:flex-start;">
            <div style="flex:1;">
              ${document.description ? `<div style="font-size:14px;line-height:1.7;color:${textColor};margin-bottom:16px;">${escapeHtml(document.description)}</div>` : ''}
              ${document.payment_instructions ? `<div style="font-size:13px;line-height:1.7;color:${secondary};margin-bottom:12px;"><strong style="color:${textColor};">Payment instructions:</strong> ${escapeHtml(document.payment_instructions)}</div>` : ''}
              ${(document.terms_and_conditions ?? template?.terms_and_conditions) ? `<div style="font-size:13px;line-height:1.7;color:${secondary};"><strong style="color:${textColor};">Terms:</strong> ${escapeHtml(document.terms_and_conditions ?? template?.terms_and_conditions)}</div>` : ''}
            </div>
            ${renderTemplate(template?.totals_section_html, variables, totalsFallback)}
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px 28px;background:#f8fafc;border-top:1px solid #e5e7eb;">${renderTemplate(template?.footer_html, variables, footerFallback)}</td>
      </tr>
    </table>
  </body>
</html>`
}

export async function sendDocumentEmail(input: {
  html: string
  text: string
  subject: string
  recipients: string[]
  from: string
  replyTo?: string | null
}) {
  const results = await Promise.all(input.recipients.map(async (recipient) => {
    const result = await sendEmail({
      from: input.from,
      to: recipient,
      replyTo: input.replyTo ?? undefined,
      subject: input.subject,
      html: input.html,
      text: input.text,
    })
    return { recipient, result }
  }))

  const failures = results.filter((row) => !row.result.ok)
  return {
    ok: failures.length === 0,
    results,
    failures,
  }
}

export type DocumentUpdateBody = {
  to_name?: string
  to_email?: string
  to_phone?: string | null
  to_contact_person?: string | null
  to_address?: Record<string, unknown>
  issue_date?: string
  due_date?: string | null
  valid_until?: string | null
  description?: string | null
  terms_and_conditions?: string | null
  payment_instructions?: string | null
  notes?: string | null
  custom_fields?: Record<string, unknown>
  currency?: string
  discount_amount?: number
  shipping_cost?: number
  po_number?: string | null
  order_number?: string | null
  reference_number?: string | null
  status?: string
  payment_status?: string | null
  quote_status?: string | null
  proposal_status?: string | null
  amount_paid?: number
  items?: DocumentItemInput[]
}

export function buildDocumentText(context: DocumentRenderContext, intro?: string): string {
  const { brand, document, items } = context
  const lines = [
    intro?.trim() || `Please find attached your ${getDocumentLabel(document.document_type).toLowerCase()}.`,
    `${getDocumentLabel(document.document_type)}: ${document.document_number}`,
    `From: ${brand.company_name ?? document.from_name}`,
    `To: ${document.to_name} <${document.to_email}>`,
    `Issue date: ${formatDisplayDate(document.issue_date)}`,
  ]

  if (document.document_type === 'invoice') {
    lines.push(`Due date: ${formatDisplayDate(document.due_date)}`)
  } else if (document.valid_until) {
    lines.push(`Valid until: ${formatDisplayDate(document.valid_until)}`)
  }

  lines.push(`Total: ${formatCurrency(toAmount(document.total_amount), document.currency ?? 'GBP')}`)

  if (items.length > 0) {
    lines.push('', 'Items:')
    for (const item of items) {
      const lineTotal = item.line_total == null ? item.quantity * item.unit_price : toAmount(item.line_total)
      lines.push(`- ${item.description}: ${item.quantity} × ${formatCurrency(item.unit_price, document.currency ?? 'GBP')} = ${formatCurrency(lineTotal, document.currency ?? 'GBP')}`)
    }
  }

  return lines.join('\n')
}