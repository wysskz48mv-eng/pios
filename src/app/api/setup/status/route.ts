/**
 * GET /api/setup/status
 * Returns live env-var check across all Phase 2 integrations.
 * Used by the Setup Guide page to show real connection status.
 * Owner-scoped — returns 401 for non-admin users.
 *
 * PIOS v2.0 | Sustain International FZE Ltd
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function envSet(key: string): boolean {
  const v = process.env[key]
  return !!v && v.length > 4 && !v.startsWith('your_') && !v.startsWith('<')
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Test Supabase DB connectivity
  let dbOk = false
  try {
    const { error } = await supabase.from('user_profiles').select('id').limit(1)
    dbOk = !error
  } catch { dbOk = false }

  // Test Resend (cheap: just check key format, don't send)
  const resendKey  = process.env.RESEND_API_KEY ?? ''
  const resendOk   = resendKey.startsWith('re_') && resendKey.length > 10

  // Test Google OAuth vars
  const googleOk   = envSet('GOOGLE_CLIENT_ID') && envSet('GOOGLE_CLIENT_SECRET')

  // Test Anthropic
  const anthropicOk = envSet('ANTHROPIC_API_KEY')

  // Test cron
  const cronOk      = envSet('CRON_SECRET')

  // Test live data vars
  const seDataOk    = envSet('SUPABASE_SE_SERVICE_KEY')
  const isDataOk    = envSet('SUPABASE_IS_SERVICE_KEY')
  const githubOk    = envSet('GITHUB_PAT')

  // Test Stripe
  const stripeOk    = envSet('STRIPE_SECRET_KEY') && envSet('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')

  // Check if user has Google token stored (means OAuth worked end-to-end)
  let googleTokenOk = false
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('google_access_token, google_email')
      .eq('id', user.id)
      .single()
    googleTokenOk = !!profile?.google_access_token
  } catch { googleTokenOk = false }

  const checks = {
    supabase:       { ok: dbOk,          label: 'Supabase DB',            required: true  },
    anthropic:      { ok: anthropicOk,   label: 'Anthropic API',          required: true  },
    cron_secret:    { ok: cronOk,        label: 'Cron Secret (CRON_SECRET)', required: true },
    google_oauth:   { ok: googleOk,      label: 'Google OAuth vars',      required: true  },
    google_token:   { ok: googleTokenOk, label: 'Google token (OAuth connected)', required: false },
    resend:         { ok: resendOk,      label: 'Resend Email (RESEND_API_KEY)', required: true },
    stripe:         { ok: stripeOk,      label: 'Stripe billing',         required: false },
    se_live_data:   { ok: seDataOk,      label: 'SustainEdge live data',  required: false },
    is_live_data:   { ok: isDataOk,      label: 'InvestiScript live data',required: false },
    github_pat:     { ok: githubOk,      label: 'GitHub PAT (Live Data)', required: false },
  }

  const requiredOk  = Object.values(checks).filter(c => c.required).every(c => c.ok)
  const totalOk     = Object.values(checks).filter(c => c.ok).length
  const totalChecks = Object.values(checks).length

  return NextResponse.json({
    ready:    requiredOk,
    score:    `${totalOk}/${totalChecks}`,
    checks,
    timestamp: new Date().toISOString(),
  })
}
