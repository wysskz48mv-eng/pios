/**
 * GET /api/email/view?id=<email_item_id>
 * Fetches the full email body and thread from Gmail/Microsoft.
 * Stores body in email_items for future access without re-fetching.
 *
 * Returns: { email, thread, attachments }
 *
 * PIOS v3.7.2 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // Get email item + account
    const { data: emailItem } = await supabase
      .from('email_items')
      .select('*, connected_email_accounts!email_items_account_id_fkey(google_access_token_enc, google_refresh_token_enc, google_token_expiry, ms_access_token_enc, provider)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!emailItem) return NextResponse.json({ error: 'Email not found' }, { status: 404 })

    // If we already have the body cached, return it
    if (emailItem.body_text && emailItem.full_body_fetched) {
      return NextResponse.json({
        email: emailItem,
        thread: [],
        cached: true,
      })
    }

    // Fetch full body from provider
    const account = (emailItem as any).connected_email_accounts
    if (!account) {
      // Try fetching from user_profiles (legacy)
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('google_access_token_enc, google_refresh_token_enc, google_token_expiry')
        .eq('id', user.id)
        .single()

      if (!profile?.google_access_token_enc) {
        return NextResponse.json({ error: 'No email account connected' }, { status: 400 })
      }

      const token = await refreshIfNeeded(profile.google_access_token_enc, profile.google_refresh_token_enc, profile.google_token_expiry)
      if (!token) return NextResponse.json({ error: 'Token expired — reconnect Gmail' }, { status: 401 })

      const result = await fetchGmailFull(token, emailItem.gmail_message_id, emailItem.gmail_thread_id)

      // Cache the body
      if (result.body) {
        await supabase.from('email_items').update({
          body_text: result.body,
          full_body_fetched: true,
          unsubscribe_url: result.unsubscribeUrl ?? null,
        }).eq('id', id)
      }

      return NextResponse.json({
        email: { ...emailItem, body_text: result.body, unsubscribe_url: result.unsubscribeUrl },
        thread: result.thread,
        attachments: result.attachments,
      })
    }

    // Use account token
    let token: string | null = null
    if (account.provider === 'google') {
      token = await refreshIfNeeded(account.google_access_token_enc, account.google_refresh_token_enc, account.google_token_expiry)
    }

    if (!token) return NextResponse.json({ error: 'Token expired — reconnect' }, { status: 401 })

    const result = await fetchGmailFull(token, emailItem.gmail_message_id, emailItem.gmail_thread_id)

    // Cache
    if (result.body) {
      await supabase.from('email_items').update({
        body_text: result.body,
        full_body_fetched: true,
        unsubscribe_url: result.unsubscribeUrl ?? null,
      }).eq('id', id)
    }

    return NextResponse.json({
      email: { ...emailItem, body_text: result.body, unsubscribe_url: result.unsubscribeUrl },
      thread: result.thread,
      attachments: result.attachments,
    })
  } catch (err) {
    console.error('[PIOS email/view]', err)
    return apiError(err)
  }
}

// ── Gmail full fetch ────────────────────────────────────────────────────────

async function fetchGmailFull(token: string, messageId: string, threadId?: string | null) {
  // Fetch full message
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${token}` } },
  )

  if (!res.ok) return { body: null, thread: [], attachments: [], unsubscribeUrl: null }

  const msg = await res.json()
  const body = extractBody(msg.payload)
  const headers = extractHeaders(msg.payload?.headers ?? [])
  const unsubscribeUrl = headers['List-Unsubscribe']?.match(/<(https?:\/\/[^>]+)>/)?.[1] ?? null
  const attachments = extractAttachments(msg.payload)

  // Fetch thread if available
  let thread: { id: string; from: string; subject: string; snippet: string; date: string }[] = []
  if (threadId) {
    try {
      const threadRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (threadRes.ok) {
        const threadData = await threadRes.json()
        thread = (threadData.messages ?? [])
          .filter((m: any) => m.id !== messageId)
          .map((m: any) => {
            const h = extractHeaders(m.payload?.headers ?? [])
            return {
              id: m.id,
              from: h['From'] ?? '',
              subject: h['Subject'] ?? '',
              snippet: m.snippet ?? '',
              date: h['Date'] ?? '',
            }
          })
      }
    } catch {}
  }

  return { body, thread, attachments, unsubscribeUrl }
}

function extractHeaders(headers: { name: string; value: string }[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const h of headers) map[h.name] = h.value
  return map
}

function extractBody(payload: any): string | null {
  if (!payload) return null

  // Direct body
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8')
  }

  // Multipart — prefer text/html, fallback to text/plain
  if (payload.parts) {
    const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html')
    if (htmlPart?.body?.data) {
      return Buffer.from(htmlPart.body.data, 'base64url').toString('utf-8')
    }

    const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain')
    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, 'base64url').toString('utf-8')
    }

    // Nested multipart
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = extractBody(part)
        if (nested) return nested
      }
    }
  }

  return null
}

function extractAttachments(payload: any): { filename: string; mimeType: string; size: number; attachmentId: string }[] {
  const attachments: any[] = []

  function walk(parts: any[]) {
    for (const part of parts ?? []) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size ?? 0,
          attachmentId: part.body.attachmentId,
        })
      }
      if (part.parts) walk(part.parts)
    }
  }

  walk(payload?.parts ?? [])
  return attachments
}

// ── Token refresh ───────────────────────────────────────────────────────────

async function refreshIfNeeded(token: string | null, refreshToken: string | null, expiry: string | null): Promise<string | null> {
  if (!token) return null
  const expiryMs = expiry ? new Date(expiry).getTime() : 0
  if (expiryMs > Date.now() + 5 * 60 * 1000) return token
  if (!refreshToken) return null

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
    return data.access_token ?? null
  } catch { return null }
}
