import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * GET /auth/callback
 * Handles Supabase auth redirect after OAuth or magic link.
 *
 * Flow:
 *   1. Exchange code for session
 *   2. Upsert user_profiles row (create on first visit)
 *   3. Store Google OAuth tokens → user_profiles (enables Gmail/Calendar)
 *   4. New users → /onboarding
 *   5. Returning users → ?next= param or /platform/dashboard
 *
 * VeritasIQ Technologies Ltd · PIOS v3.2.4
 */

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code     = searchParams.get('code')
  const next     = searchParams.get('next') ?? '/platform/dashboard'
  const errorMsg = searchParams.get('error_description')

  if (errorMsg) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(errorMsg)}`
    )
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`)
  }

  const supabase = await createClient()

  // Exchange code for session — session contains provider tokens
  const { data: sessionData, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeErr) {
    console.error('[auth/callback] exchange error:', exchangeErr.message)
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(exchangeErr.message)}`
    )
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/auth/login?error=no_user`)
  }

  // ── Extract Google OAuth tokens from session ──────────────────────────────
  // provider_token / provider_refresh_token are only present on OAuth sign-ins
  const providerToken        = sessionData?.session?.provider_token        ?? null
  const providerRefreshToken = sessionData?.session?.provider_refresh_token ?? null
  const googleEmail          = user.user_metadata?.email ?? user.email ?? null

  // Use service client for all DB writes — bypasses RLS reliably
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check existing profile
  const { data: existingProfile } = await admin
    .from('user_profiles')
    .select('id, onboarded, full_name')
    .eq('id', user.id)
    .single()

  const isNewUser = !existingProfile

  if (isNewUser) {
    const fullName = user.user_metadata?.full_name
      ?? user.user_metadata?.name
      ?? user.email?.split('@')[0]
      ?? 'there'

    // NOTE: no 'email' column on user_profiles — identity is via id (FK to auth.users)
    await admin.from('user_profiles').upsert({
      id:                   user.id,
      full_name:            fullName,
      plan:                 'free',
      persona_type:         'executive',
      onboarded:            false,
      // Google tokens — may be null for magic link sign-ins
      google_access_token:  providerToken,
      google_refresh_token: providerRefreshToken,
      google_email:         googleEmail,
      google_token_expiry:  providerToken
        ? new Date(Date.now() + 3600 * 1000).toISOString()
        : null,
      created_at:           new Date().toISOString(),
      updated_at:           new Date().toISOString(),
    }, { onConflict: 'id' })

    await admin.from('exec_intelligence_config').upsert({
      user_id:        user.id,
      ai_calls_used:  0,
      ai_calls_limit: 50,
      brief_enabled:  true,
      persona:        'executive',
      updated_at:     new Date().toISOString(),
    }, { onConflict: 'user_id' })

    sendWelcomeEmail(user.email ?? '', fullName).catch(() => {})
    return NextResponse.redirect(`${origin}/onboarding`)
  }

  // ── Returning user — update Google tokens if this was a Google OAuth ──────
  if (providerToken) {
    await admin.from('user_profiles').update({
      google_access_token:  providerToken,
      google_refresh_token: providerRefreshToken ?? existingProfile?.google_refresh_token,
      google_email:         googleEmail,
      google_token_expiry:  new Date(Date.now() + 3600 * 1000).toISOString(),
      updated_at:           new Date().toISOString(),
    }).eq('id', user.id)
  }

  // Only block on explicit false — null/missing should not trap user in loop
  const destination = (existingProfile?.onboarded === false) ? '/onboarding' : next
  return NextResponse.redirect(`${origin}${destination}`)
}

// ── Fire-and-forget welcome email ──────────────────────────────────────────
async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from   = process.env.RESEND_FROM_EMAIL ?? 'PIOS <onboarding@resend.dev>'
  if (!apiKey || !to) return
  const first = name.split(' ')[0]
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pios-wysskz48mv-engs-projects.vercel.app'

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: 'Welcome to PIOS — your command centre is ready',
      html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#07080f;font-family:'DM Sans',system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#07080f;">
<tr><td align="center" style="padding:40px 16px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#0b0d18;border:1px solid #1a1f34;border-radius:16px;overflow:hidden;">
  <tr><td style="padding:32px 32px 28px;background:linear-gradient(135deg,#0f0a2e,#0b0d18);">
    <div style="width:40px;height:40px;background:linear-gradient(135deg,#8b7cf8,#4f8ef7);border-radius:10px;margin-bottom:20px;">
      <span style="font-size:18px;font-weight:800;color:#fff;display:block;text-align:center;line-height:40px;">P</span>
    </div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#eceef8;">Welcome to PIOS, ${first}.</h1>
    <p style="margin:0;font-size:14px;color:#636880;">Your Personal Intelligence Operating System is ready.</p>
  </td></tr>
  <tr><td style="padding:28px 32px;">
    <p style="margin:0 0 20px;font-size:14px;color:#a8adc8;line-height:1.7;">
      Complete your profile so NemoClaw™ can calibrate to your context.
    </p>
    <a href="${appUrl}/onboarding"
       style="display:inline-block;background:#8b7cf8;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:8px;">
      Complete your setup →
    </a>
  </td></tr>
  <tr><td style="padding:18px 32px;background:#0f1120;border-top:1px solid #1a1f34;">
    <p style="margin:0;font-size:11px;color:#636880;">
      PIOS by VeritasIQ Technologies Ltd ·
      <a href="mailto:info@veritasiq.io" style="color:#8b7cf8;text-decoration:none;">info@veritasiq.io</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`,
    }),
  })
}
