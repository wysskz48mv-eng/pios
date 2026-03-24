/**
 * GET /api/auth/callback/microsoft
 * Microsoft Entra ID OAuth 2.0 callback handler.
 *
 * Exchanges authorisation code for tokens, fetches user profile
 * from Microsoft Graph, and registers the account in
 * connected_email_accounts.
 *
 * Handles three account scenarios transparently:
 *   - Personal Microsoft account (outlook.com, hotmail.com, live.com)
 *   - Work / organisational M365 (any company domain)
 *   - University / institutional M365 (e.g. port.ac.uk, cam.ac.uk)
 *
 * If the user's tenant IT has blocked third-party OAuth consent,
 * Microsoft returns an error here and we redirect to settings
 * with a clear IMAP fallback suggestion.
 *
 * PIOS v2.2 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'

export const runtime = 'nodejs'

const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const MS_GRAPH_ME  = 'https://graph.microsoft.com/v1.0/me'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pios.veritasiq.io'
  const { searchParams } = new URL(req.url)

  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const msError = searchParams.get('error')
  const msErrorDesc = searchParams.get('error_description')

  // ── Microsoft returned an error ───────────────────────────────────────────
  // Common cases:
  //   AADSTS65001 — user/admin has not consented (institutional IT block)
  //   AADSTS50011 — redirect URI mismatch (misconfigured Azure app)
  //   access_denied — user clicked Cancel
  if (msError) {
    const isConsentBlocked = msErrorDesc?.includes('AADSTS65001') ||
                             msErrorDesc?.includes('consent') ||
                             msError === 'access_denied'

    const msg = isConsentBlocked
      ? 'Your organisation has restricted third-party app access. Use IMAP + app password to connect this inbox instead.'
      : `Microsoft sign-in failed: ${msErrorDesc ?? msError}`

    return NextResponse.redirect(
      `${appUrl}/platform/settings?tab=email&error=${encodeURIComponent(msg)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/platform/settings?tab=email&error=No+authorisation+code`)
  }

  // ── Decode state ──────────────────────────────────────────────────────────
  let context = 'personal'
  let label   = ''
  try {
    const decoded = JSON.parse(Buffer.from(state ?? '', 'base64url').toString())
    context = decoded.context ?? 'personal'
    label   = decoded.label   ?? ''
  } catch { /* use defaults */ }

  // ── Exchange code for tokens ──────────────────────────────────────────────
  const clientId     = process.env.AZURE_CLIENT_ID!
  const clientSecret = process.env.AZURE_CLIENT_SECRET!
  const redirectUri  = `${appUrl}/api/auth/callback/microsoft`

  let tokenData: unknown
  try {
    const tokenRes = await fetch(MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        code,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
        scope:         'openid profile email offline_access User.Read Mail.Read Mail.Send Calendars.Read',
      }),
    })
    tokenData = await tokenRes.json()
  } catch {
    return NextResponse.redirect(`${appUrl}/platform/settings?tab=email&error=Token+exchange+failed`)
  }

  if ((tokenData as any).error) {
    return NextResponse.redirect(
      `${appUrl}/platform/settings?tab=email&error=${encodeURIComponent((tokenData as any).error_description ?? (tokenData as any).error)}`
    )
  }

  const { access_token, refresh_token, expires_in, id_token } = tokenData

  // ── Fetch Microsoft Graph /me profile ────────────────────────────────────
  let msProfile: unknown
  try {
    const meRes = await fetch(MS_GRAPH_ME, {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    msProfile = await meRes.json()
  } catch {
    return NextResponse.redirect(`${appUrl}/platform/settings?tab=email&error=Could+not+fetch+Microsoft+profile`)
  }

  const emailAddress = (msProfile as any).mail ?? (msProfile as any).userPrincipalName ?? ''
  const displayName  = (msProfile as any).displayName ?? ''

  // Extract tenant ID from access token claims (JWT middle segment)
  let msTenantId: string | null = null
  try {
    const claims = JSON.parse(Buffer.from(access_token.split('.')[1], 'base64url').toString())
    msTenantId = claims.tid ?? null
  } catch { /* non-critical */ }

  const tokenExpiry = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString()

  // ── Auto-detect context from email domain ─────────────────────────────────
  // If user didn't specify context, infer from domain
  let inferredContext = context
  if (context === 'personal') {
    const domain = emailAddress.split('@')[1]?.toLowerCase() ?? ''
    const personalDomains = ['outlook.com','hotmail.com','live.com','msn.com','hotmail.co.uk','live.co.uk']
    const academicPatterns = ['.ac.uk','.edu','.ac.nz','.edu.au','university','uni.']
    const govPatterns = ['.gov.uk','.gov.au','.gov.ie','nhs.net','mod.uk']

    if (!personalDomains.includes(domain)) {
      if (academicPatterns.some(p => domain.includes(p))) inferredContext = 'academic'
      else if (govPatterns.some(p => domain.includes(p)))  inferredContext = 'secondment'
      else                                                   inferredContext = 'work'
    }
  }

  // Auto-label if not provided
  const autoLabel = label || (
    inferredContext === 'academic'   ? 'University Email'   :
    inferredContext === 'secondment' ? 'Secondment Email'   :
    inferredContext === 'work'       ? 'Work Email'         :
    'Outlook / Microsoft'
  )

  // ── Register account in Supabase ──────────────────────────────────────────
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login?error=session_expired`)
  }

  // Check if first account (make primary)
  const { count } = await supabase
    .from('connected_email_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true)

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  // Upsert — handles reconnect of previously disconnected account
  const { error: upsertErr } = await supabase
    .from('connected_email_accounts')
    .upsert({
      user_id:          user.id,
      tenant_id:        profile?.tenant_id,
      provider:         'microsoft',
      email_address:    emailAddress.toLowerCase(),
      display_name:     displayName || autoLabel,
      context:          inferredContext,
      label:            autoLabel,
      ms_access_token:  access_token,
      ms_refresh_token: refresh_token,
      ms_token_expiry:  tokenExpiry,
      ms_tenant_id:     msTenantId,
      ms_scopes:        ['Mail.Read','Mail.Send','Calendars.Read','User.Read'],
      is_primary:       (count ?? 0) === 0,
      is_active:        true,
      sync_enabled:     true,
      ai_triage_enabled: true,
      receipt_scan_enabled: inferredContext !== 'secondment',  // disable for secondment by default
      disconnected_at:  null,
      updated_at:       new Date().toISOString(),
    }, { onConflict: 'user_id,email_address' })

  if (upsertErr) {
    return NextResponse.redirect(
      `${appUrl}/platform/settings?tab=email&error=${encodeURIComponent(upsertErr.message)}`
    )
  }

  return NextResponse.redirect(
    `${appUrl}/platform/settings?tab=email&connected=${encodeURIComponent(emailAddress)}`
  )
}
