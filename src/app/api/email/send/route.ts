import { apiError } from '@/lib/api-error'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/email/send
// Sends an email via Gmail API using the user's stored OAuth token.
// Requires gmail.modify scope (already requested in OAuth flow).
//
// body: {
//   to: string           — recipient email
//   subject: string      — email subject
//   body: string         — plain text body
//   replyTo?: string     — optional: thread reply-to email ID
//   threadId?: string    — optional: Gmail thread ID to reply within
// }
// ─────────────────────────────────────────────────────────────────────────────

async function getGoogleToken(supabase: any, userId: string): Promise<string | null> {
  // Try connected_email_accounts first (new path), then user_profiles (legacy)
  const { data: account } = await supabase
    .from('connected_email_accounts')
    .select('google_access_token_enc, google_refresh_token_enc, google_token_expiry')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('provider', 'google')
    .limit(1)
    .maybeSingle()

  const token = account?.google_access_token_enc
  const refresh = account?.google_refresh_token_enc
  const expiry = account?.google_token_expiry

  if (!token && !refresh) {
    // Fall back to user_profiles (legacy)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('google_access_token_enc, google_refresh_token_enc, google_token_expiry')
      .eq('id', userId)
      .single()
    if (!profile?.google_access_token_enc) return null
    return profile.google_access_token_enc
  }

  // Refresh inline if within 5 min of expiry
  if (refresh && expiry) {
    const expiryMs = new Date(expiry).getTime()
    if (expiryMs <= Date.now() + 5 * 60 * 1000) {
      try {
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID ?? '',
            client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
            refresh_token: refresh,
            grant_type: 'refresh_token',
          }),
        })
        const data = await res.json()
        if (data.access_token) {
          const newExpiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString()
          await supabase.from('connected_email_accounts')
            .update({ google_access_token_enc: data.access_token, google_token_expiry: newExpiry })
            .eq('user_id', userId)
            .eq('provider', 'google')
            .eq('is_active', true)
          return data.access_token
        }
      } catch {}
    }
  }

  return token
}

function makeRFC2822(to: string, subject: string, body: string, from: string): string {
  const nl = '\r\n'
  const msg = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ].join(nl)
  // Base64url encode
  return Buffer.from(msg).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { to, subject, body: emailBody, threadId } = body

    if (!to?.trim())      return NextResponse.json({ error: 'Recipient (to) required' }, { status: 400 })
    if (!subject?.trim()) return NextResponse.json({ error: 'Subject required' }, { status: 400 })
    if (!emailBody?.trim()) return NextResponse.json({ error: 'Email body required' }, { status: 400 })

    // Get Google token
    const token = await getGoogleToken(supabase, user.id)
    if (!token) {
      return NextResponse.json({
        error: 'Google sending is not connected. Open Settings → Email Accounts to connect or reconnect a Google inbox for email sending.',
        code: 'GOOGLE_NOT_CONNECTED',
      }, { status: 400 })
    }

    // Get sender email from profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('google_email, full_name')
      .eq('id', user.id)
      .single()
    const from = profile?.full_name
      ? `${profile.full_name} <${profile.google_email ?? user.email}>`
      : (profile?.google_email ?? user.email ?? '')

    // Build RFC 2822 message
    const rawMessage = makeRFC2822(to, subject, emailBody, from)

    // Send via Gmail API
    const gmailRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: rawMessage,
          ...(threadId ? { threadId } : {}),
        }),
      }
    )

    if (!gmailRes.ok) {
      const errData = await gmailRes.json()
      const errMsg = errData?.error?.message ?? `Gmail API error ${gmailRes.status}`

      // Handle insufficient scope error
      if (gmailRes.status === 403 || errMsg.includes('insufficient')) {
        return NextResponse.json({
          error: 'Google send permission not granted. Reconnect your Google inbox in Settings → Email Accounts with full mail access.',
          code: 'INSUFFICIENT_SCOPE',
        }, { status: 403 })
      }
      return NextResponse.json({ error: errMsg }, { status: gmailRes.status })
    }

    const sent = await gmailRes.json()

    // Mark source email as actioned if replyTo provided
    if (body.email_item_id) {
      await supabase
        .from('email_items')
        .update({ status: 'actioned', updated_at: new Date().toISOString() })
        .eq('id', body.email_item_id)
        .eq('user_id', user.id)
    }

    return NextResponse.json({
      sent: true,
      message_id: sent.id,
      thread_id: sent.threadId,
      to,
      subject,
    })
  } catch (err: unknown) {
    console.error('/api/email/send:', err)
    return apiError(err)
  }
}
