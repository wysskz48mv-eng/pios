import { createClient } from '@/lib/supabase/server'

export const BRAND_DOCUMENT_TYPES = ['invoice', 'quote', 'proposal', 'purchase_order', 'receipt'] as const

export type BrandDocumentType = typeof BRAND_DOCUMENT_TYPES[number]

export type BrandSettingsRecord = {
  id?: string
  tenant_id: string
  company_name?: string | null
  company_legal_name?: string | null
  company_tax_id?: string | null
  company_website?: string | null
  company_phone?: string | null
  company_email?: string | null
  company_address?: Record<string, unknown> | null
  company_logo_url?: string | null
  logo_url?: string | null
  logo_width?: number | null
  logo_height?: number | null
  primary_color?: string | null
  secondary_color?: string | null
  accent_color?: string | null
  background_color?: string | null
  text_color?: string | null
  font_family?: string | null
  heading_font?: string | null
  invoice_prefix?: string | null
  next_invoice_number?: number | null
  quote_prefix?: string | null
  next_quote_number?: number | null
  proposal_prefix?: string | null
  next_proposal_number?: number | null
  purchase_order_prefix?: string | null
  next_purchase_order_number?: number | null
  next_po_number?: number | null
  receipt_prefix?: string | null
  next_receipt_number?: number | null
  email_sender_name?: string | null
  email_from_name?: string | null
  email_from_address?: string | null
  email_reply_to?: string | null
  payment_details?: Record<string, unknown> | null
  bank_details?: Record<string, unknown> | null
  footer_text?: string | null
  legal_footer?: string | null
  terms_and_conditions?: string | null
  metadata?: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
}

export type UserTenantProfile = {
  tenant_id: string
  role?: string | null
  full_name?: string | null
  organisation?: string | null
  email?: string | null
}

function normaliseColor(input: unknown, fallback: string): string {
  const value = String(input ?? '').trim()
  return /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback
}

function normalisePositiveInt(input: unknown, fallback: number): number {
  const value = Number(input)
  return Number.isInteger(value) && value > 0 ? value : fallback
}

function isStoragePath(value: string | null | undefined): value is string {
  return !!value && !/^https?:\/\//i.test(value)
}

export async function getUserTenantProfile() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('tenant_id,role,full_name,organisation')
    .eq('id', user.id)
    .single<{ tenant_id?: string | null; role?: string | null; full_name?: string | null; organisation?: string | null }>()

  if (error) throw error
  if (!profile?.tenant_id) return { supabase, user, profile: null }

  return {
    supabase,
    user,
    profile: {
      tenant_id: profile.tenant_id,
      role: profile.role,
      full_name: profile.full_name,
      organisation: profile.organisation,
      email: user.email,
    } satisfies UserTenantProfile,
  }
}

export function buildDefaultBrandSettings(profile: UserTenantProfile): BrandSettingsRecord {
  return {
    tenant_id: profile.tenant_id,
    company_name: profile.organisation ?? profile.full_name ?? 'PIOS',
    company_email: profile.email ?? null,
    company_address: {},
    company_logo_url: null,
    logo_url: null,
    logo_width: 200,
    logo_height: 60,
    primary_color: '#0f4c81',
    secondary_color: '#6b7280',
    accent_color: '#d97706',
    background_color: '#ffffff',
    text_color: '#333333',
    font_family: 'system-ui',
    heading_font: 'system-ui',
    invoice_prefix: 'INV',
    next_invoice_number: 1001,
    quote_prefix: 'QTE',
    next_quote_number: 2001,
    proposal_prefix: 'PROP',
    next_proposal_number: 3001,
    purchase_order_prefix: 'PO',
    next_purchase_order_number: 4001,
    next_po_number: 4001,
    receipt_prefix: 'RCP',
    next_receipt_number: 5001,
    email_sender_name: profile.organisation ?? profile.full_name ?? 'PIOS',
    email_from_name: profile.organisation ?? profile.full_name ?? 'PIOS',
    email_from_address: profile.email ?? null,
    email_reply_to: profile.email ?? null,
    payment_details: {},
    bank_details: {},
    footer_text: 'Thank you for your business.',
    legal_footer: 'Thank you for your business.',
    terms_and_conditions: 'Payment due according to agreed terms.',
    metadata: {},
  }
}

export function sanitizeBrandSettingsInput(input: Record<string, unknown>, profile: UserTenantProfile) {
  const defaults = buildDefaultBrandSettings(profile)
  const logoUrl = typeof input.company_logo_url === 'string'
    ? input.company_logo_url.trim() || null
    : typeof input.logo_url === 'string'
      ? input.logo_url.trim() || null
      : undefined

  return {
    tenant_id: profile.tenant_id,
    company_name: typeof input.company_name === 'string' ? input.company_name.trim() || null : defaults.company_name,
    company_legal_name: typeof input.company_legal_name === 'string' ? input.company_legal_name.trim() || null : undefined,
    company_tax_id: typeof input.company_tax_id === 'string' ? input.company_tax_id.trim() || null : undefined,
    company_website: typeof input.company_website === 'string' ? input.company_website.trim() || null : undefined,
    company_phone: typeof input.company_phone === 'string' ? input.company_phone.trim() || null : undefined,
    company_email: typeof input.company_email === 'string' ? input.company_email.trim() || null : defaults.company_email,
    company_address: typeof input.company_address === 'object' && input.company_address !== null ? input.company_address : defaults.company_address,
    company_logo_url: logoUrl,
    logo_url: logoUrl,
    logo_width: normalisePositiveInt(input.logo_width, defaults.logo_width ?? 200),
    logo_height: normalisePositiveInt(input.logo_height, defaults.logo_height ?? 60),
    primary_color: normaliseColor(input.primary_color, defaults.primary_color ?? '#0f4c81'),
    secondary_color: normaliseColor(input.secondary_color, defaults.secondary_color ?? '#6b7280'),
    accent_color: normaliseColor(input.accent_color, defaults.accent_color ?? '#d97706'),
    background_color: normaliseColor(input.background_color, defaults.background_color ?? '#ffffff'),
    text_color: normaliseColor(input.text_color, defaults.text_color ?? '#333333'),
    font_family: typeof input.font_family === 'string' ? input.font_family.trim() || defaults.font_family : defaults.font_family,
    heading_font: typeof input.heading_font === 'string' ? input.heading_font.trim() || defaults.heading_font : defaults.heading_font,
    invoice_prefix: typeof input.invoice_prefix === 'string' ? input.invoice_prefix.trim().toUpperCase() || defaults.invoice_prefix : defaults.invoice_prefix,
    next_invoice_number: normalisePositiveInt(input.next_invoice_number, defaults.next_invoice_number ?? 1001),
    quote_prefix: typeof input.quote_prefix === 'string' ? input.quote_prefix.trim().toUpperCase() || defaults.quote_prefix : defaults.quote_prefix,
    next_quote_number: normalisePositiveInt(input.next_quote_number, defaults.next_quote_number ?? 2001),
    proposal_prefix: typeof input.proposal_prefix === 'string' ? input.proposal_prefix.trim().toUpperCase() || defaults.proposal_prefix : defaults.proposal_prefix,
    next_proposal_number: normalisePositiveInt(input.next_proposal_number, defaults.next_proposal_number ?? 3001),
    purchase_order_prefix: typeof input.purchase_order_prefix === 'string' ? input.purchase_order_prefix.trim().toUpperCase() || defaults.purchase_order_prefix : defaults.purchase_order_prefix,
    next_purchase_order_number: normalisePositiveInt(input.next_purchase_order_number ?? input.next_po_number, defaults.next_purchase_order_number ?? 4001),
    next_po_number: normalisePositiveInt(input.next_po_number ?? input.next_purchase_order_number, defaults.next_po_number ?? 4001),
    receipt_prefix: typeof input.receipt_prefix === 'string' ? input.receipt_prefix.trim().toUpperCase() || defaults.receipt_prefix : defaults.receipt_prefix,
    next_receipt_number: normalisePositiveInt(input.next_receipt_number, defaults.next_receipt_number ?? 5001),
    email_sender_name: typeof input.email_sender_name === 'string' ? input.email_sender_name.trim() || null : defaults.email_sender_name,
    email_from_name: typeof input.email_from_name === 'string' ? input.email_from_name.trim() || null : defaults.email_from_name,
    email_from_address: typeof input.email_from_address === 'string' ? input.email_from_address.trim() || null : defaults.email_from_address,
    email_reply_to: typeof input.email_reply_to === 'string' ? input.email_reply_to.trim() || null : defaults.email_reply_to,
    payment_details: typeof input.payment_details === 'object' && input.payment_details !== null ? input.payment_details : defaults.payment_details,
    bank_details: typeof input.bank_details === 'object' && input.bank_details !== null ? input.bank_details : defaults.bank_details,
    footer_text: typeof input.footer_text === 'string' ? input.footer_text.trim() || null : defaults.footer_text,
    legal_footer: typeof input.legal_footer === 'string' ? input.legal_footer.trim() || null : defaults.legal_footer,
    terms_and_conditions: typeof input.terms_and_conditions === 'string' ? input.terms_and_conditions.trim() || null : defaults.terms_and_conditions,
    metadata: typeof input.metadata === 'object' && input.metadata !== null ? input.metadata : defaults.metadata,
  }
}

export async function resolveBrandLogoUrl(pathOrUrl: string | null | undefined): Promise<string | null> {
  if (!pathOrUrl) return null
  if (!isStoragePath(pathOrUrl)) return pathOrUrl

  const supabase = createClient()
  const { data, error } = await (supabase as any).storage.from('pios-files').createSignedUrl(pathOrUrl, 60 * 60 * 24 * 7)
  if (error) return null
  return data?.signedUrl ?? null
}
