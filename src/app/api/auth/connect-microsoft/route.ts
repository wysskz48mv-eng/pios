/**
 * GET /api/auth/connect-microsoft
 * Initiates Microsoft Entra ID OAuth 2.0 flow for connecting
 * a Microsoft 365 / Outlook account to PIOS.
 *
 * Supports all Microsoft account types:
 *   - Personal Outlook.com / Hotmail  (tenant = 'consumers')
 *   - Work / organisation M365        (tenant = 'organizations' or specific tenant ID)
 *   - University / institutional M365 (same as work — uses 'common' for broad compat)
 *   - Secondment accounts             (IMAP fallback recommended if OAuth blocked)
 *
 * Requires env vars:
 *   AZURE_CLIENT_ID       — from Azure Portal app registration
 *   AZURE_CLIENT_SECRET   — from Azure Portal app registration
 *   NEXT_PUBLIC_APP_URL   — base URL for redirect URI
 *
 * After user consents, Microsoft redirects to:
 *   /api/auth/callback/microsoft?code=...&state=...
 *
 * PIOS v2.2 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Microsoft Graph scopes needed for PIOS
// Mail.Read + Mail.Send for inbox sync
// Calendars.Read for calendar integration
// User.Read for profile/email address
// offline_access for refresh tokens (critical — without this no long-lived access)
const MS_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'User.Read',
  'Mail.Read',
  'Mail.Send',
  'Calendars.Read',
].join(' ')

export async function GET(req: NextRequest) {
  const clientId  = process.env.AZURE_CLIENT_ID
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pios.veritasiq.io'

  if (!clientId) {
    return NextResponse.json(
      { error: 'Microsoft OAuth not configured. Add AZURE_CLIENT_ID to Vercel environment variables.' },
      { status: 503 }
    )
  }

  const { searchParams } = new URL(req.url)
  const context = searchParams.get('context') ?? 'personal'
  const label   = searchParams.get('label')   ?? ''

  // 'common' endpoint accepts both personal Microsoft accounts AND work/school accounts.
  // This covers: personal Outlook, university M365, work M365 — all in one flow.
  // If the user's institutional IT has blocked third-party OAuth consent, this will
  // fail gracefully with a Microsoft error page (not a PIOS error).
  const tenantEndpoint = 'common'

  const redirectUri = `${appUrl}/api/auth/callback/microsoft`

  // State carries context metadata through the OAuth round-trip
  const state = Buffer.from(JSON.stringify({ context, label, ts: Date.now() })).toString('base64url')

  const authoriseUrl = new URL(
    `https://login.microsoftonline.com/${tenantEndpoint}/oauth2/v2.0/authorize`
  )
  authoriseUrl.searchParams.set('client_id',     clientId)
  authoriseUrl.searchParams.set('response_type', 'code')
  authoriseUrl.searchParams.set('redirect_uri',  redirectUri)
  authoriseUrl.searchParams.set('scope',         MS_SCOPES)
  authoriseUrl.searchParams.set('response_mode', 'query')
  authoriseUrl.searchParams.set('state',         state)
  // prompt=select_account forces Microsoft to show account picker
  // even if user already has an active session — essential for
  // adding a second M365 account (e.g. secondment email)
  authoriseUrl.searchParams.set('prompt',        'select_account')

  return NextResponse.redirect(authoriseUrl.toString())
}
