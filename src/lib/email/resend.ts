/**
 * lib/email/resend.ts
 * Transactional email via Resend API.
 * Used by: cron/brief (daily delivery), onboarding, notifications.
 *
 * PIOS v2.0 | Sustain International FZE Ltd
 */

const RESEND_API = 'https://api.resend.com/emails'

export interface EmailPayload {
  to:      string
  subject: string
  html:    string
  text?:   string
  from?:   string
  replyTo?: string
}

export interface EmailResult {
  ok:    boolean
  id?:   string
  error?: string
}

/**
 * Send a transactional email via Resend.
 * Returns { ok: false } gracefully — never throws.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[resend] RESEND_API_KEY not set — email skipped')
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  const from = payload.from ?? process.env.RESEND_FROM_EMAIL ?? 'PIOS <noreply@veritasiq.io>'

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from,
        to:      [payload.to],
        subject: payload.subject,
        html:    payload.html,
        text:    payload.text,
        reply_to: payload.replyTo,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('[resend] API error:', data)
      return { ok: false, error: data?.message ?? `HTTP ${res.status}` }
    }
    return { ok: true, id: data.id }
  } catch (err: any) {
    console.error('[resend] Fetch error:', err.message)
    return { ok: false, error: err.message }
  }
}

// ─── Email templates ───────────────────────────────────────────────────────

/** Morning brief email HTML */
export function morningBriefHtml(briefContent: string, date: string, userName: string): string {
  const dateFormatted = new Date(date).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  // Convert plain text paragraphs to HTML paragraphs
  const contentHtml = briefContent
    .split('\n\n')
    .filter(Boolean)
    .map(p => `<p style="margin:0 0 14px;line-height:1.7;color:#c8cedd;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0a0b0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0b0d;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background:#111318;border-radius:12px 12px 0 0;padding:28px 36px;border-bottom:1px solid rgba(255,255,255,0.06);">
          <table width="100%"><tr>
            <td><span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#454d63;font-weight:600;">PIOS</span><br/>
            <span style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">Morning Brief</span></td>
            <td align="right"><span style="font-size:12px;color:#454d63;font-family:monospace;">${dateFormatted}</span></td>
          </tr></table>
        </td></tr>
        <!-- Greeting -->
        <tr><td style="background:#111318;padding:28px 36px 0;">
          <p style="margin:0 0 20px;font-size:15px;font-weight:600;color:#a78bfa;">Good morning, ${userName.split(' ')[0]} 👋</p>
          ${contentHtml}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#0e1015;border-radius:0 0 12px 12px;padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:#454d63;line-height:1.6;">
            You're receiving this because you have morning briefs enabled in PIOS.<br/>
            <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://pios-wysskz48mv-engs-projects.vercel.app'}/platform/settings" style="color:#a78bfa;text-decoration:none;">Manage preferences</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/** Plain-text fallback for morning brief */
export function morningBriefText(briefContent: string, date: string, userName: string): string {
  const dateFormatted = new Date(date).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  return `PIOS Morning Brief — ${dateFormatted}\n\nGood morning, ${userName.split(' ')[0]}\n\n${briefContent}\n\n---\nManage preferences: ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://pios-wysskz48mv-engs-projects.vercel.app'}/platform/settings`
}

/** Trial / welcome email */
export function welcomeHtml(userName: string, plan: string): string {
  return `<!DOCTYPE html>
<html><body style="background:#0a0b0d;font-family:-apple-system,sans-serif;padding:40px 20px;">
  <table width="600" style="max-width:600px;margin:0 auto;background:#111318;border-radius:12px;padding:36px;">
    <tr><td>
      <p style="font-size:11px;letter-spacing:2px;color:#454d63;text-transform:uppercase;margin:0 0 8px;">PIOS</p>
      <h1 style="margin:0 0 20px;font-size:24px;color:#fff;">Welcome, ${userName.split(' ')[0]}</h1>
      <p style="color:#c8cedd;line-height:1.7;">Your PIOS account is active on the <strong style="color:#a78bfa;">${plan}</strong> plan. Your morning brief will land in your inbox every day at 08:00 UAE time.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? '#'}/platform/dashboard" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#a78bfa;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Open PIOS →</a>
    </td></tr>
  </table>
</body></html>`
}
