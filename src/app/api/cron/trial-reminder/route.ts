import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

/**
 * POST /api/cron/trial-reminder
 * Vercel Cron — runs daily at 09:00 UTC.
 * Sends reminder emails to trial users whose trial expires tomorrow.
 * Protected by CRON_SECRET bearer header.
 * VeritasIQ Technologies Ltd · PIOS
 */

export const dynamic     = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('Authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Find users whose trial ends tomorrow (within 20–28 hour window)
  const tomorrow     = new Date(Date.now() + 24 * 3600000)
  const windowStart  = new Date(Date.now() + 20 * 3600000).toISOString()
  const windowEnd    = new Date(Date.now() + 28 * 3600000).toISOString()

  const { data: profiles } = await admin
    .from('user_profiles')
    .select('id, full_name, email, trial_end')
    .eq('plan', 'trial')
    .gte('trial_end', windowStart)
    .lte('trial_end', windowEnd)

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No trials expiring tomorrow' })
  }

  const apiKey = process.env.RESEND_API_KEY
  const from   = process.env.RESEND_FROM_EMAIL ?? 'PIOS <info@veritasiq.io>'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pios-wysskz48mv-engs-projects.vercel.app'

  let sent = 0
  const errors: string[] = []

  for (const profile of profiles as Array<{ id: string; full_name?: string; email?: string; trial_end?: string }>) {
    if (!profile.email) continue

    const first    = (profile.full_name ?? 'there').split(' ')[0]
    const endDate  = new Date(profile.trial_end!).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    })

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#07080f;font-family:'DM Sans',system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#07080f;">
<tr><td align="center" style="padding:40px 16px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#0b0d18;border:1px solid #1a1f34;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
  <tr><td style="padding:32px;background:linear-gradient(135deg,#2d1a0a,#0b0d18);">
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#eceef8;">
      Your PIOS trial ends tomorrow, ${first}.
    </h1>
    <p style="margin:0;font-size:14px;color:#636880;">Access expires ${endDate}</p>
  </td></tr>
  <tr><td style="padding:28px 32px;">
    <p style="margin:0 0 16px;font-size:14px;color:#a8adc8;line-height:1.7;">
      You have until tomorrow to upgrade and keep everything you've built — your OKRs, decisions, NemoClaw™ calibration, and morning brief schedule.
    </p>
    <div style="background:#0f1120;border:1px solid #1a1f34;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:12px;font-weight:700;color:#636880;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px;">
        Continue from £29/month
      </div>
      ${[
        ['PIOS Starter — £29/mo', '100 AI credits · Core platform · NemoClaw™ AI'],
        ['PIOS Pro — £79/mo', '500 AI credits · All 13 frameworks · Content pipeline'],
        ['PIOS Enterprise — £199/mo', 'Unlimited AI · Priority support · White-label'],
      ].map(([plan, desc]) => `
      <div style="padding:8px 0;border-bottom:1px solid #1a1f34;">
        <div style="font-size:13px;font-weight:600;color:#eceef8;">${plan}</div>
        <div style="font-size:11px;color:#636880;">${desc}</div>
      </div>`).join('')}
    </div>
    <table cellpadding="0" cellspacing="0">
      <tr><td>
        <a href="${appUrl}/platform/billing"
           style="display:inline-block;background:#8b7cf8;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:8px;">
          Upgrade now →
        </a>
      </td></tr>
    </table>
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

    if (!apiKey) {
      errors.push(`${profile.email}: RESEND_API_KEY not set`)
      continue
    }

    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: profile.email,
          subject: `Your PIOS trial ends tomorrow — upgrade to keep access`,
          html,
        }),
      })
      if (r.ok) sent++
      else errors.push(`${profile.email}: HTTP ${r.status}`)
    } catch (e) {
      errors.push(`${profile.email}: ${e}`)
    }
  }

  return NextResponse.json({
    ok:      errors.length === 0,
    sent,
    errors:  errors.length,
    total:   profiles.length,
  })
}
