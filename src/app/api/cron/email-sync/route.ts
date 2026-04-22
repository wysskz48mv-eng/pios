/**
 * GET /api/cron/email-sync
 * Vercel Cron — runs every 30 minutes
 * Syncs unread emails for all users with connected accounts.
 *
 * For each connected account:
 *   1. Refresh OAuth token if needed
 *   2. Fetch unread emails from Gmail or Microsoft Graph
 *   3. Run AI triage classification
 *   4. Store results in email_items table
 *
 * PIOS v3.7.2 | VeritasIQ Technologies Ltd
 */
import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callClaude } from '@/lib/ai/client'
import { encryptOAuthToken, decryptOAuthTokenSafe } from '@/lib/security/oauth-token-crypto'
import { requireCronSecret } from '@/lib/security/route-guards'

export const runtime = 'nodejs'
export const maxDuration = 120

interface ConnectedAccount {
  id: string
  user_id: string
  email_address: string
  provider: string
  is_active: boolean
  sync_enabled: boolean
  ai_triage_enabled: boolean
  receipt_scan_enabled: boolean
  ai_domain_override: string | null
  google_access_token_enc: string | null
  google_refresh_token_enc: string | null
  google_token_expiry: string | null
  ms_access_token_enc: string | null
  ms_refresh_token_enc: string | null
  ms_token_expiry: string | null
}

export async function GET(req: NextRequest) {
  const blocked = requireCronSecret(req)
  if (blocked) return blocked

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
  }

  const supabase = createClient(url, key)
  const results: { email: string; synced: number; errors: string[] }[] = []

  // Fetch all active, sync-enabled connected accounts
  const { data: accounts, error } = await supabase
    .from('connected_email_accounts')
    .select('*')
    .eq('is_active', true)
    .eq('sync_enabled', true)

  if (error || !accounts?.length) {
    return NextResponse.json({
      ok: true,
      message: 'No active accounts to sync',
      accounts_checked: 0,
    })
  }

  for (const account of accounts as ConnectedAccount[]) {
    const accountResult = { email: account.email_address, synced: 0, errors: [] as string[] }

    try {
      if (account.provider === 'google') {
        const token = await ensureGoogleToken(supabase, account)
        if (!token) {
          accountResult.errors.push('Token refresh failed')
          results.push(accountResult)
          continue
        }

        const emails = await fetchGmailUnread(token)
        for (const email of emails) {
          const exists = await supabase
            .from('email_items')
            .select('id')
            .eq('user_id', account.user_id)
            .eq('gmail_message_id', email.id)
            .maybeSingle()

          if (exists.data) continue // already synced

          let triage = null
          if (account.ai_triage_enabled) {
            triage = await triageEmail(
              email.subject,
              email.from,
              email.snippet,
              account.ai_domain_override,
            )
          }

          await supabase.from('email_items').insert({
            user_id: account.user_id,
            account_id: account.id,
            gmail_message_id: email.id,
            subject: email.subject,
            sender_name: email.from,
            sender_email: email.fromEmail,
            snippet: email.snippet,
            received_at: email.date,
            domain_tag: triage?.domain ?? account.ai_domain_override ?? 'personal',
            priority_score: triage?.priority_score ?? 5,
            action_required: triage?.action_required ?? null,
            ai_draft_reply: triage?.ai_draft_reply ?? null,
            is_receipt: triage?.is_receipt ?? false,
            receipt_data: triage?.receipt_data ?? null,
            status: 'unprocessed',
          })
          accountResult.synced++
        }
      }

      if (account.provider === 'microsoft') {
        const token = await ensureMicrosoftToken(supabase, account)
        if (!token) {
          accountResult.errors.push('Token refresh failed')
          results.push(accountResult)
          continue
        }

        const emails = await fetchMicrosoftUnread(token)
        for (const email of emails) {
          const exists = await supabase
            .from('email_items')
            .select('id')
            .eq('user_id', account.user_id)
            .eq('gmail_message_id', email.id)
            .maybeSingle()

          if (exists.data) continue

          let triage = null
          if (account.ai_triage_enabled) {
            triage = await triageEmail(
              email.subject,
              email.from,
              email.snippet,
              account.ai_domain_override,
            )
          }

          await supabase.from('email_items').insert({
            user_id: account.user_id,
            account_id: account.id,
            gmail_message_id: email.id,
            subject: email.subject,
            sender_name: email.from,
            sender_email: email.fromEmail,
            snippet: email.snippet,
            received_at: email.date,
            domain_tag: triage?.domain ?? account.ai_domain_override ?? 'personal',
            priority_score: triage?.priority_score ?? 5,
            action_required: triage?.action_required ?? null,
            ai_draft_reply: triage?.ai_draft_reply ?? null,
            is_receipt: triage?.is_receipt ?? false,
            receipt_data: triage?.receipt_data ?? null,
            status: 'unprocessed',
          })
          accountResult.synced++
        }
      }
    } catch (err: unknown) {
      accountResult.errors.push((err as Error).message)
    }

    results.push(accountResult)
  }

  const totalSynced = results.reduce((sum, r) => sum + r.synced, 0)

  return NextResponse.json({
    ok: true,
    accounts_checked: accounts.length,
    emails_synced: totalSynced,
    results,
  })
}

// ── Token refresh helpers ───────────────────────────────────────────────────

async function ensureGoogleToken(supabase: any, account: ConnectedAccount): Promise<string | null> {
  const expiry = account.google_token_expiry ? new Date(account.google_token_expiry).getTime() : 0
  const currentAccess = decryptOAuthTokenSafe(account.google_access_token_enc)
  if (currentAccess && expiry > Date.now() + 5 * 60 * 1000) {
    return currentAccess
  }

  const refreshToken = decryptOAuthTokenSafe(account.google_refresh_token_enc)
  if (!refreshToken) return null

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.access_token) return null

    const newExpiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString()
    const payload: Record<string, unknown> = {
      google_access_token_enc: encryptOAuthToken(data.access_token),
      google_token_expiry: newExpiry,
      token_encryption_alg: 'aes-256-gcm',
    }
    if (data.refresh_token) payload.google_refresh_token_enc = encryptOAuthToken(data.refresh_token)

    await supabase.from('connected_email_accounts')
      .update(payload)
      .eq('id', account.id)
    return data.access_token
  } catch { return null }
}

async function ensureMicrosoftToken(supabase: any, account: ConnectedAccount): Promise<string | null> {
  const expiry = account.ms_token_expiry ? new Date(account.ms_token_expiry).getTime() : 0
  const currentAccess = decryptOAuthTokenSafe(account.ms_access_token_enc)
  if (currentAccess && expiry > Date.now() + 5 * 60 * 1000) {
    return currentAccess
  }

  const refreshToken = decryptOAuthTokenSafe(account.ms_refresh_token_enc)
  if (!refreshToken) return null

  try {
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.AZURE_CLIENT_ID!,
        client_secret: process.env.AZURE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'Mail.Read Mail.Send Calendars.Read User.Read offline_access',
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.access_token) return null

    const newExpiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString()
    const payload: Record<string, unknown> = {
      ms_access_token_enc: encryptOAuthToken(data.access_token),
      ms_token_expiry: newExpiry,
      token_encryption_alg: 'aes-256-gcm',
    }
    if (data.refresh_token) payload.ms_refresh_token_enc = encryptOAuthToken(data.refresh_token)

    await supabase.from('connected_email_accounts')
      .update(payload)
      .eq('id', account.id)
    return data.access_token
  } catch { return null }
}

// ── Email fetch helpers ─────────────────────────────────────────────────────

interface RawEmail {
  id: string
  subject: string
  from: string
  fromEmail: string
  snippet: string
  date: string
}

async function fetchGmailUnread(token: string): Promise<RawEmail[]> {
  const listRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=is:unread',
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const listData = await listRes.json()
  if (!listData.messages?.length) return []

  const emails: RawEmail[] = []
  for (const msg of listData.messages.slice(0, 10)) {
    const detailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    const detail = await detailRes.json()
    const headers = detail.payload?.headers ?? []
    const getHeader = (name: string) => headers.find((h: any) => h.name === name)?.value ?? ''

    const fromRaw = getHeader('From')
    const fromMatch = fromRaw.match(/^(.*?)\s*<(.+?)>$/)

    emails.push({
      id: msg.id,
      subject: getHeader('Subject'),
      from: fromMatch?.[1]?.replace(/"/g, '').trim() ?? fromRaw,
      fromEmail: fromMatch?.[2] ?? fromRaw,
      snippet: detail.snippet ?? '',
      date: getHeader('Date'),
    })
  }
  return emails
}

async function fetchMicrosoftUnread(token: string): Promise<RawEmail[]> {
  const res = await fetch(
    'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter=isRead eq false&$top=10&$select=id,subject,from,bodyPreview,receivedDateTime',
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const data = await res.json()
  if (!data.value?.length) return []

  return data.value.map((msg: any) => ({
    id: msg.id,
    subject: msg.subject ?? '',
    from: msg.from?.emailAddress?.name ?? '',
    fromEmail: msg.from?.emailAddress?.address ?? '',
    snippet: msg.bodyPreview ?? '',
    date: msg.receivedDateTime ?? new Date().toISOString(),
  }))
}

// ── AI triage ───────────────────────────────────────────────────────────────

async function triageEmail(
  subject: string,
  from: string,
  snippet: string,
  domainOverride: string | null,
) {
  const system = `PIOS email triage. Return ONLY valid JSON: { "domain": string, "priority_score": 1-10, "action_required": string|null, "ai_draft_reply": string|null, "is_receipt": boolean, "receipt_data": object|null }`
  const domainHint = domainOverride ? `\nForce domain to: ${domainOverride}` : ''

  try {
    const raw = await callClaude(
      [{ role: 'user', content: `Subject: ${subject}\nFrom: ${from}\nSnippet: ${snippet.slice(0, 500)}${domainHint}` }],
      system,
      400,
      'haiku',
    )

    const cleaned = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}
