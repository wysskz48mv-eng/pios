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

async function getGoogleToken(supabase: unknown, userId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('google_access_token, google_refresh_token, google_token_expiry, google_email')
    .eq('id', userId)
    .single()

  if (!profile?.google_access_token) return null

  // Refresh if within 5 min of expiry
  if (profile.google_token_expiry) {
    const expiry = new Date(profile.google_token_expiry)
    if (expiry <= new Date(Date.now() + 5 * 60 * 1000) && profile.google_refresh_token) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        await fetch(`${appUrl}/api/auth/refresh-google`, { method: 'POST' })
        const { data: fresh } = await supabase
          .from('user_profiles')
          .select('google_access_token')
          .eq('id', userId)
          .single()
        return fresh?.google_access_token ?? profile.google_access_token
      } catch {
        return profile.google_access_token
      }
    }
  }
  return profile.google_access_token
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
        error: 'Google not connected. Connect Gmail in Settings to enable email sending.',
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
      const errData = await gmailRes.json().catch(() => ({}))
      const errMsg = errData?.error?.message ?? `Gmail API error ${gmailRes.status}`

      // Handle insufficient scope error
      if (gmailRes.status === 403 || errMsg.includes('insufficient')) {
        return NextResponse.json({
          error: 'Gmail send permission not granted. Please reconnect Google in Settings with full Gmail access.',
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
    return NextResponse.json({ error: err.message ?? 'Send failed' }, { status: 500 })
  }
}
