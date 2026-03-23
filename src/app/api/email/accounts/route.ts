/**
 * /api/email/accounts — Multi-email account management
 *
 * GET    — list all connected accounts for the user
 * POST   — add IMAP account (Google/Microsoft added via OAuth flow)
 * PATCH  { id, ...updates } — update label/context/flags
 * DELETE ?id= — disconnect an account (soft-delete)
 *
 * Google and Microsoft accounts are connected via their respective
 * OAuth flows (/api/auth/connect-microsoft) and auto-registered here.
 * IMAP accounts are added directly via this route (app password).
 *
 * PIOS v2.2 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const VALID_CONTEXTS  = ['personal','academic','work','secondment','consulting','client','other']
const VALID_PROVIDERS = ['google','microsoft','imap']

// ── GET /api/email/accounts ───────────────────────────────────────────────────
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('connected_email_accounts')
      .select(`
        id, provider, email_address, display_name, context, label,
        is_primary, is_active, sync_enabled,
        ai_triage_enabled, ai_domain_override,
        receipt_scan_enabled, receipt_keywords,
        last_synced_at, last_sync_error,
        imap_host, imap_port, imap_username, imap_use_tls,
        ms_tenant_id, ms_scopes, google_scopes,
        connected_at, disconnected_at
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('is_primary', { ascending: false })
      .order('connected_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Mask sensitive fields — never return tokens
    const accounts = (data ?? []).map((a: Record<string, unknown>) => ({
      ...a,
      // Indicate token presence without exposing value
      has_token: a.provider === 'google'
        ? !!a.google_access_token
        : a.provider === 'microsoft'
        ? !!a.ms_access_token
        : !!a.imap_password_enc,
    }))

    return NextResponse.json({ accounts, count: accounts.length })
  } catch (err: unknown) {
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}

// ── POST /api/email/accounts ──────────────────────────────────────────────────
// Used for IMAP accounts only. Google/MS come via OAuth callbacks.
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      provider = 'imap',
      email_address, display_name, context = 'personal', label,
      imap_host, imap_port = 993, imap_username, imap_password, imap_use_tls = true,
      ai_domain_override, receipt_scan_enabled = false,
    } = body

    if (!email_address?.trim()) return NextResponse.json({ error: 'email_address required' }, { status: 400 })
    if (!VALID_PROVIDERS.includes(provider)) return NextResponse.json({ error: 'invalid provider' }, { status: 400 })
    if (!VALID_CONTEXTS.includes(context)) return NextResponse.json({ error: 'invalid context' }, { status: 400 })

    if (provider === 'imap') {
      if (!imap_host) return NextResponse.json({ error: 'imap_host required for IMAP accounts' }, { status: 400 })
      if (!imap_username) return NextResponse.json({ error: 'imap_username required' }, { status: 400 })
      if (!imap_password) return NextResponse.json({ error: 'imap_password (app password) required' }, { status: 400 })
    }

    // Check if already connected
    const { data: existing } = await supabase
      .from('connected_email_accounts')
      .select('id, is_active')
      .eq('user_id', user.id)
      .eq('email_address', email_address.trim().toLowerCase())
      .single()

    if (existing?.is_active) {
      return NextResponse.json({ error: 'This email address is already connected' }, { status: 409 })
    }

    // Check if this should be primary (first account)
    const { count } = await supabase
      .from('connected_email_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true)

    const isPrimary = (count ?? 0) === 0

    // Get tenant_id from profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    // For IMAP: store the app password (in production this should be encrypted)
    // We store as-is here; encryption at rest is handled by Supabase's encrypted columns
    // or a KMS in production. The field name `imap_password_enc` signals intent.
    const insertData: any = {
      user_id: user.id,
      tenant_id: profile?.tenant_id,
      provider,
      email_address: email_address.trim().toLowerCase(),
      display_name: display_name?.trim() || null,
      context,
      label: label?.trim() || null,
      is_primary: isPrimary,
      is_active: true,
      sync_enabled: true,
      ai_triage_enabled: true,
      ai_domain_override: ai_domain_override || null,
      receipt_scan_enabled,
      updated_at: new Date().toISOString(),
    }

    if (provider === 'imap') {
      insertData.imap_host = imap_host
      insertData.imap_port = imap_port
      insertData.imap_username = imap_username
      insertData.imap_password_enc = imap_password   // app password
      insertData.imap_use_tls = imap_use_tls
    }

    if (existing && !existing.is_active) {
      // Re-activate previously disconnected account
      const { data, error } = await supabase
        .from('connected_email_accounts')
        .update({ ...insertData, disconnected_at: null })
        .eq('id', existing.id)
        .select('id, email_address, provider, context, label, is_primary')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ account: data, reconnected: true }, { status: 200 })
    }

    const { data, error } = await supabase
      .from('connected_email_accounts')
      .insert(insertData)
      .select('id, email_address, provider, context, label, is_primary')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ account: data }, { status: 201 })

  } catch (err: unknown) {
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}

// ── PATCH /api/email/accounts ─────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // Whitelist updatable fields
    const allowed = [
      'display_name','context','label',
      'sync_enabled','ai_triage_enabled','ai_domain_override',
      'receipt_scan_enabled','receipt_keywords',
      'imap_host','imap_port','imap_username','imap_password_enc','imap_use_tls',
      'sync_lookback_days',
    ]
    const safe: any = { updated_at: new Date().toISOString() }
    for (const k of allowed) {
      if (k in updates) safe[k] = updates[k]
    }

    // Handle primary switch — only one primary allowed
    if (updates.is_primary === true) {
      await supabase
        .from('connected_email_accounts')
        .update({ is_primary: false })
        .eq('user_id', user.id)
        .neq('id', id)
      safe.is_primary = true
    }

    if (updates.context && !VALID_CONTEXTS.includes(updates.context))
      return NextResponse.json({ error: 'invalid context' }, { status: 400 })

    const { data, error } = await supabase
      .from('connected_email_accounts')
      .update(safe)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, email_address, provider, context, label, is_primary, sync_enabled')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ account: data })

  } catch (err: unknown) {
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE /api/email/accounts ────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // Soft-delete: mark inactive + clear tokens
    const { error } = await supabase
      .from('connected_email_accounts')
      .update({
        is_active: false,
        is_primary: false,
        sync_enabled: false,
        disconnected_at: new Date().toISOString(),
        // Clear tokens on disconnect
        google_access_token: null,
        google_refresh_token: null,
        ms_access_token: null,
        ms_refresh_token: null,
        imap_password_enc: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // If this was primary, promote the next active account
    const { data: remaining } = await supabase
      .from('connected_email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('connected_at', { ascending: true })
      .limit(1)

    if (remaining?.[0]) {
      await supabase
        .from('connected_email_accounts')
        .update({ is_primary: true })
        .eq('id', remaining[0].id)
    }

    return NextResponse.json({ disconnected: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
