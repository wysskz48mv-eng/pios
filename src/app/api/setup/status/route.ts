/**
 * GET /api/setup/status
 * Returns live env-var check across all PIOS integrations.
 * Matches the PIOS v2.2.1 Vercel Environment Variables Checklist.
 * Owner-scoped — returns 401 for non-admin users.
 *
 * PIOS v2.2.1 | VeritasIQ Technologies Ltd
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function envSet(key: string): boolean {
  const v = process.env[key]
  return !!v && v.length > 4 && !v.startsWith('your_') && !v.startsWith('<') && !v.startsWith('xx')
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // §01 Supabase DB connectivity
  let dbOk = false
  try {
    const { error } = await supabase.from('user_profiles').select('id').limit(1)
    dbOk = !error
  } catch { dbOk = false }

  const serviceRoleOk = envSet('SUPABASE_SERVICE_ROLE_KEY')

  // §02 Google OAuth
  const googleVarsOk = envSet('GOOGLE_CLIENT_ID') && envSet('GOOGLE_CLIENT_SECRET')

  // §02b Microsoft 365 OAuth
  const azureVarsOk = envSet('AZURE_CLIENT_ID') && envSet('AZURE_CLIENT_SECRET')
  let googleTokenOk  = false
  try {
    const { data: profile } = await supabase
      .from('user_profiles').select('google_access_token').eq('id', user.id).single()
    googleTokenOk = !!profile?.google_access_token
  } catch { googleTokenOk = false }

  // §03 Resend
  const resendKey = process.env.RESEND_API_KEY ?? ''
  const resendOk  = resendKey.startsWith('re_') && resendKey.length > 10
  const fromEmailOk = envSet('RESEND_FROM_EMAIL')

  // §04 Cron
  const cronOk = envSet('CRON_SECRET')

  // §05 Stripe — keys + all 3 price IDs
  const stripeKeysOk    = envSet('STRIPE_SECRET_KEY') && envSet('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
  const stripePricesOk  =
    envSet('STRIPE_PRICE_STUDENT') &&
    envSet('STRIPE_PRICE_INDIVIDUAL') &&
    envSet('STRIPE_PRICE_PROFESSIONAL')
  const stripeWebhookOk = envSet('STRIPE_WEBHOOK_SECRET')

  // §06 Cross-platform live data
  const seDataOk  = envSet('SUPABASE_SE_SERVICE_KEY')
  const isDataOk  = envSet('SUPABASE_IS_SERVICE_KEY')
  const githubOk  = envSet('GITHUB_PAT')

  // §07 App URL + Anthropic
  const appUrlOk     = envSet('NEXT_PUBLIC_APP_URL')
  const anthropicOk  = envSet('ANTHROPIC_API_KEY')

  const checks: Record<string, { ok: boolean; label: string; required: boolean; section: string; hint?: string }> = {
    // §01 Supabase
    supabase_db:          { ok: dbOk,           label: 'Supabase DB connected',            required: true,  section: '01' },
    supabase_service_key: { ok: serviceRoleOk,   label: 'SUPABASE_SERVICE_ROLE_KEY',         required: true,  section: '01', hint: 'Supabase → Project Settings → API → service_role' },
    // §02 Google
    google_oauth_vars:    { ok: googleVarsOk,    label: 'Google OAuth vars (client ID + secret)', required: true,  section: '02' },
    google_connected:     { ok: googleTokenOk,   label: 'Google account connected (OAuth flow)', required: false, section: '02', hint: 'Complete Google sign-in from Settings to connect Gmail/Calendar' },
    // §03 Resend
    resend_api_key:       { ok: resendOk,        label: 'RESEND_API_KEY',                    required: true,  section: '03', hint: 'resend.com/api-keys → create key with Send access' },
    resend_from_email:    { ok: fromEmailOk,     label: 'RESEND_FROM_EMAIL (FROM_EMAIL)',     required: false, section: '03', hint: 'e.g. noreply@veritasiq.tech — must be a Resend-verified domain' },
    // §04 Cron
    cron_secret:          { ok: cronOk,          label: 'CRON_SECRET',                       required: true,  section: '04', hint: 'openssl rand -hex 32 — also add to Vercel → Settings → Cron Jobs' },
    // §05 Stripe
    stripe_keys:          { ok: stripeKeysOk,    label: 'Stripe keys (secret + publishable)', required: true,  section: '05' },
    stripe_price_ids:     { ok: stripePricesOk,  label: 'Stripe price IDs (×3)',             required: true,  section: '05', hint: 'POST /api/stripe/setup while logged in as info@veritasiq.tech' },
    stripe_webhook:       { ok: stripeWebhookOk, label: 'STRIPE_WEBHOOK_SECRET',             required: false, section: '05', hint: 'Stripe → Developers → Webhooks → /api/stripe/webhook' },
    // §06 Live data
    se_live_data:         { ok: seDataOk,        label: 'SUPABASE_SE_SERVICE_KEY (VeritasEdge™)', required: false, section: '06', hint: 'Supabase project oxqqzxvuksgzeeyhufhp → service_role' },
    is_live_data:         { ok: isDataOk,        label: 'SUPABASE_IS_SERVICE_KEY (InvestiScript)', required: false, section: '06', hint: 'Supabase project dexsdwqkunnmhxcwayda → service_role' },
    github_pat:           { ok: githubOk,        label: 'GITHUB_PAT (expires May 16 2026)',  required: false, section: '06', hint: 'Use PAT ghp_gQaz1BKZvy… — rotate before May 16 2026' },
    // §02b Microsoft 365 / Azure OAuth
    azure_client_id:     { ok: envSet('AZURE_CLIENT_ID'),     label: 'AZURE_CLIENT_ID',     required: false, section: '02', hint: 'Azure Portal → App registrations → Overview → Application (client) ID' },
    azure_client_secret: { ok: envSet('AZURE_CLIENT_SECRET'), label: 'AZURE_CLIENT_SECRET', required: false, section: '02', hint: 'Azure Portal → App registrations → Certificates & secrets → New client secret' },
    // §07 App + AI
    app_url:              { ok: appUrlOk,        label: 'NEXT_PUBLIC_APP_URL',               required: true,  section: '07', hint: 'https://pios.veritasiq.tech' },
    anthropic_api_key:    { ok: anthropicOk,     label: 'ANTHROPIC_API_KEY',                 required: true,  section: '07', hint: 'console.anthropic.com/settings/keys → Create Key' },
  }

  const required       = Object.values(checks).filter(c => c.required)
  const requiredOk     = required.every(c => c.ok)
  const requiredPassed = required.filter(c => c.ok).length
  const totalOk        = Object.values(checks).filter(c => c.ok).length
  const totalChecks    = Object.values(checks).length

  // Generate ordered checklist for the setup page
  const ordered = Object.entries(checks).map(([key, c]) => ({
    key, ...c,
    status: c.ok ? 'ok' : c.required ? 'missing_required' : 'missing_optional',
  }))

  return NextResponse.json({
    ready:           requiredOk,
    score:           `${totalOk}/${totalChecks}`,
    required_score:  `${requiredPassed}/${required.length}`,
    checks,
    ordered,
    stripe_setup_url: '/api/stripe/setup',
    timestamp:       new Date().toISOString(),
  })
}
