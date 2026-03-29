import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

/**
 * POST /api/trial/start
 * Creates a 3-day evaluation account for prospects.
 *
 * Body: { email, full_name, company?, role? }
 *
 * Flow:
 *   1. Create Supabase auth user (magic link login)
 *   2. Insert user_profiles with plan='trial', trial_end = now + 3 days
 *   3. Seed exec_intelligence_config with 20 AI credits (trial limit)
 *   4. Send trial welcome email with login link
 *   5. Return { ok, message }
 *
 * GET /api/trial/status — check trial status for current user
 *
 * VeritasIQ Technologies Ltd · PIOS
 */

export const dynamic = 'force-dynamic'

const TRIAL_DAYS    = 3
const TRIAL_CREDITS = 20

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, full_name, company, role } = body as {
      email: string; full_name: string; company?: string; role?: string
    }

    if (!email || !full_name) {
      return NextResponse.json({ error: 'email and full_name required' }, { status: 400 })
    }

    const adminSb = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)

    // Create auth user (or get existing)
    const { data: authData, error: authErr } = await adminSb.auth.admin.createUser({
      email,
      email_confirm: true,   // skip email confirmation for trials
      user_metadata: { full_name, company, role, source: 'trial_signup' },
    })

    // If user already exists, that's fine — they can restart trial
    const userId = authData?.user?.id
    if (!userId && authErr?.message !== 'A user with this email address has already been registered') {
      return NextResponse.json({ error: authErr?.message ?? 'User creation failed' }, { status: 400 })
    }

    // Get existing user ID if already registered
    let finalUserId = userId
    if (!finalUserId) {
      const { data: existing } = await adminSb.auth.admin.listUsers()
      const found = existing?.users?.find((u: { email?: string; id: string }) => u.email === email)
      finalUserId = found?.id
    }

    if (!finalUserId) {
      return NextResponse.json({ error: 'Could not create or find user' }, { status: 500 })
    }

    // Upsert user profile with trial plan
    await adminSb.from('user_profiles').upsert({
      id:             finalUserId,
      full_name,
      email,
      plan:           'trial',
      billing_status: 'trial',
      trial_end:      trialEnd.toISOString(),
      persona_type:   'executive',
      onboarded:      false,
      company:        company ?? null,
      job_title:      role ?? null,
      created_at:     new Date().toISOString(),
      updated_at:     new Date().toISOString(),
    }, { onConflict: 'id' })

    // Seed exec_intelligence_config with trial credits
    await adminSb.from('exec_intelligence_config').upsert({
      user_id:        finalUserId,
      ai_calls_used:  0,
      ai_calls_limit: TRIAL_CREDITS,
      reset_date:     trialEnd.toISOString(),
      brief_enabled:  true,
      persona:        'executive',
      updated_at:     new Date().toISOString(),
    }, { onConflict: 'user_id' })

    // Send magic link login email
    const { data: linkData } = await adminSb.auth.admin.generateLink({
      type:  'magiclink',
      email,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding` },
    })

    const loginUrl = linkData?.properties?.action_link
      ?? `${process.env.NEXT_PUBLIC_APP_URL}/auth/login`

    // Send trial welcome email
    await sendTrialEmail(email, full_name, loginUrl, trialEnd)

    return NextResponse.json({
      ok:        true,
      message:   `Trial account created. Check ${email} for your login link.`,
      trial_end: trialEnd.toISOString(),
      credits:   TRIAL_CREDITS,
    })
  } catch (err: unknown) {
    console.error('[api/trial/start]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Trial creation failed' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const adminSb = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get current user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { data: profile } = await adminSb
      .from('user_profiles')
      .select('plan,trial_end,billing_status')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ on_trial: false })

    const trialEnd  = profile.trial_end ? new Date(profile.trial_end) : null
    const now       = new Date()
    const expired   = trialEnd ? trialEnd < now : true
    const daysLeft  = trialEnd
      ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000))
      : 0

    return NextResponse.json({
      on_trial:   profile.plan === 'trial',
      expired,
      days_left:  daysLeft,
      trial_end:  trialEnd?.toISOString() ?? null,
      plan:       profile.plan,
    })
  } catch (err) {
    return NextResponse.json({ on_trial: false, error: String(err) })
  }
}

async function sendTrialEmail(
  to: string,
  name: string,
  loginUrl: string,
  trialEnd: Date
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from   = process.env.RESEND_FROM_EMAIL ?? 'PIOS <onboarding@resend.dev>'
  if (!apiKey) return

  const first   = name.split(' ')[0]
  const endDate = trialEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#07080f;font-family:'DM Sans',system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#07080f;">
<tr><td align="center" style="padding:40px 16px;">
<table width="560" cellpadding="0" cellspacing="0"
  style="background:#0b0d18;border:1px solid #1a1f34;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">

  <tr><td style="padding:32px;background:linear-gradient(135deg,#0f0a2e,#0b0d18);">
    <div style="width:40px;height:40px;background:linear-gradient(135deg,#8b7cf8,#4f8ef7);border-radius:10px;margin-bottom:20px;text-align:center;line-height:40px;">
      <span style="font-size:18px;font-weight:800;color:#fff;">P</span>
    </div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#eceef8;letter-spacing:-0.02em;">
      Your 3-day PIOS trial starts now, ${first}.
    </h1>
    <p style="margin:0;font-size:14px;color:#636880;">Full access until ${endDate}</p>
  </td></tr>

  <tr><td style="padding:28px 32px;">
    <p style="margin:0 0 16px;font-size:14px;color:#a8adc8;line-height:1.7;">
      You have <strong style="color:#eceef8;">3 days of full access</strong> and
      <strong style="color:#8b7cf8;">20 AI credits</strong> to explore PIOS — the Personal
      Intelligence Operating System built for founders, CEOs, and senior consultants.
    </p>

    <div style="background:#0f1120;border:1px solid #1a1f34;border-radius:10px;padding:18px 20px;margin-bottom:20px;">
      <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#636880;text-transform:uppercase;letter-spacing:0.07em;">
        What to try first
      </p>
      ${[
        ['Upload your CV', 'NemoClaw™ calibrates to your exact career context'],
        ['Set an OKR', 'Define what you\'re working toward this quarter'],
        ['Generate your morning brief', 'AI daily intelligence from your live data'],
        ['Log a strategic decision', 'Build your institutional memory from day one'],
      ].map(([title, desc]) => `
      <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #1a1f34;">
        <span style="color:#8b7cf8;font-size:14px;flex-shrink:0;margin-top:1px;">◉</span>
        <div>
          <div style="font-size:13px;font-weight:600;color:#eceef8;margin-bottom:2px;">${title}</div>
          <div style="font-size:12px;color:#636880;">${desc}</div>
        </div>
      </div>`).join('')}
    </div>

    <table cellpadding="0" cellspacing="0">
      <tr><td>
        <a href="${loginUrl}"
           style="display:inline-block;background:#8b7cf8;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:8px;">
          Enter PIOS →
        </a>
      </td></tr>
    </table>

    <p style="margin:20px 0 0;font-size:12px;color:#636880;line-height:1.6;">
      This link logs you in directly — no password needed. It expires in 24 hours.
      After your trial, upgrade to continue at £29/month.
    </p>
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
</body></html>`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: `Your PIOS trial is live — ${TRIAL_DAYS} days, full access`,
      html,
    }),
  }).catch(() => {})
}
