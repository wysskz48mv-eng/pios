import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

/**
 * POST /api/email/send-draft
 * Sends an approved draft OR discards it.
 * ALWAYS sends from the inbox the original email arrived in.
 *
 * Body: { draft_id, body?, action? }
 *   action: 'send' (default) | 'discard'
 *
 * Sends via Gmail API using the account token stored for
 * the inbox_address on the draft record.
 *
 * VeritasIQ Technologies Ltd · PIOS Sprint K
 */

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { draft_id, body: updatedBody, action = 'send' } = await req.json()
  if (!draft_id) return NextResponse.json({ error: 'draft_id required' }, { status: 400 })

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Load draft
  const { data: draft, error: draftErr } = await admin
    .from('email_drafts')
    .select('*')
    .eq('id', draft_id)
    .eq('user_id', user.id)
    .single()

  if (draftErr || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }
  if (draft.status !== 'draft') {
    return NextResponse.json({ error: `Draft already ${draft.status}` }, { status: 400 })
  }

  // Handle discard
  if (action === 'discard') {
    await admin.from('email_drafts').update({ status: 'discarded', updated_at: new Date().toISOString() }).eq('id', draft_id)
    // Delete from Gmail if draft was created there
    if (draft.gmail_draft_id && draft.inbox_address) {
      await deleteGmailDraft(draft.inbox_address, draft.gmail_draft_id, user.id, admin)
    }
    return NextResponse.json({ ok: true, action: 'discarded' })
  }

  // Load the account for the CORRECT inbox
  const { data: account } = await admin
    .from('connected_email_accounts')
    .select('email_address,google_access_token_enc,google_refresh_token_enc,google_token_expiry,provider')
    .eq('user_id', user.id)
    .eq('email_address', draft.inbox_address)  // ← MUST match original inbox
    .eq('is_active', true)
    .single()

  if (!account) {
    return NextResponse.json({ error: `Inbox ${draft.inbox_address} not connected` }, { status: 400 })
  }

  // Refresh token if expired
  let accessToken = account.google_access_token_enc
  if (account.google_refresh_token_enc) {
    const expiry = account.google_token_expiry ? new Date(account.google_token_expiry).getTime() : 0
    if (expiry < Date.now() + 5 * 60 * 1000) {
      const refreshed = await refreshGoogleTokenInline(account.google_refresh_token_enc)
      if (refreshed) {
        accessToken = refreshed.access_token
        await admin.from('connected_email_accounts')
          .update({ google_access_token_enc: refreshed.access_token, google_token_expiry: refreshed.expiry })
          .eq('email_address', draft.inbox_address)
          .eq('user_id', user.id)
      }
    }
  }

  if (!accessToken) {
    return NextResponse.json({
      error: 'Token expired — reconnect your Gmail in Settings.',
      code: 'TOKEN_EXPIRED',
    }, { status: 401 })
  }

  const bodyToSend = updatedBody ?? draft.body

  // Send via Gmail
  const sent = await sendGmailEmail({
    accessToken,
    refreshToken: account.google_refresh_token_enc ?? '',
    fromAddress:  account.email_address,  // ← CORRECT inbox
    toAddress:    draft.to_address,
    subject:      draft.subject,
    bodyText:     bodyToSend,
    gmailDraftId: draft.gmail_draft_id,   // send the existing draft if possible
  })

  if (!sent) {
    return NextResponse.json({ error: 'Failed to send — check inbox connection' }, { status: 500 })
  }

  // Mark as sent
  await admin.from('email_drafts').update({
    status:     'sent',
    body:       bodyToSend,
    sent_at:    new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', draft_id)

  return NextResponse.json({ ok: true, action: 'sent', from: account.email_address })
}

/* ── Send via Gmail API ─────────────────────────────────────── */
async function sendGmailEmail({
  accessToken, refreshToken, fromAddress, toAddress,
  subject, bodyText, gmailDraftId,
}: {
  accessToken:  string
  refreshToken: string
  fromAddress:  string
  toAddress:    string
  subject:      string
  bodyText:     string
  gmailDraftId?: string
}): Promise<boolean> {
  try {
    // Refresh token
    let token = accessToken
    if (!token && refreshToken) {
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    new URLSearchParams({
          client_id:     process.env.GOOGLE_CLIENT_ID ?? '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
          refresh_token: refreshToken,
          grant_type:    'refresh_token',
        }),
      })
      const rd = await r.json()
      token = rd.access_token
    }
    if (!token) return false

    // If draft exists in Gmail, send it directly
    if (gmailDraftId) {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(fromAddress)}/drafts/send`,
        {
          method:  'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({ id: gmailDraftId }),
        }
      )
      if (res.ok) return true
      // Fall through to direct send if draft send fails
    }

    // Direct send
    const mimeLines = [
      `From: ${fromAddress}`,
      `To: ${toAddress}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `MIME-Version: 1.0`,
      ``,
      bodyText,
    ]
    const encoded = Buffer.from(mimeLines.join('\r\n')).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(fromAddress)}/messages/send`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ raw: encoded }),
      }
    )
    return res.ok

  } catch (err) {
    console.error('[send-draft]', err)
    return false
  }
}

/* ── Inline token refresh ──────────────────────────────────── */
async function refreshGoogleTokenInline(refreshToken: string): Promise<{ access_token: string; expiry: string } | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    const data = await res.json()
    if (!data.access_token) return null
    return {
      access_token: data.access_token,
      expiry: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
    }
  } catch { return null }
}

/* ── Delete Gmail draft ─────────────────────────────────────── */
async function deleteGmailDraft(
  inboxAddress: string, draftId: string,
  userId: string, admin: any
): Promise<void> {
  try {
    const { data: account } = await admin
      .from('connected_email_accounts')
      .select('google_access_token_enc')
      .eq('user_id', userId)
      .eq('email_address', inboxAddress)
      .single()

    const accessToken = account?.google_access_token_enc as string | undefined
    if (!accessToken) return

    await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(inboxAddress)}/drafts/${draftId}`,
      { method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` } }
    )
  } catch { /* non-fatal */ }
}
