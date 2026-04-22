/**
 * POST /api/email/sync
 * Syncs emails from ALL connected accounts (Google + Microsoft Graph).
 * PIOS v3.0 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { callClaude }                from '@/lib/ai/client'
import { decryptOAuthTokenSafe, encryptOAuthToken } from '@/lib/security/oauth-token-crypto'

export const runtime = 'nodejs'
export const maxDuration = 60

const DOMAINS = ['academic','fm_consulting','saas','business','personal']
const TOKEN_REFRESH_BUFFER_MS = 10 * 60 * 1000

function logEmailSync(event: string, meta?: Record<string, unknown>) {
  console.log('[email/sync]', JSON.stringify({ event, ts: new Date().toISOString(), ...(meta ?? {}) }))
}

export async function refreshGoogleToken(
  supabase: any,
  account: any,
  opts?: { force?: boolean; userId?: string },
): Promise<string | null> {
  const refreshToken = decryptOAuthTokenSafe(account.google_refresh_token_enc)
  if (!refreshToken) return null

  const force = opts?.force ?? false
  const existing = decryptOAuthTokenSafe(account.google_access_token_enc)
  if (!force && existing) {
    const expiryMs = account.google_token_expiry ? new Date(account.google_token_expiry).getTime() : 0
    if (!expiryMs || expiryMs > Date.now() + TOKEN_REFRESH_BUFFER_MS) {
      return existing
    }
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }),
    })

    const data = await res.json()
    if (!res.ok || !data.access_token) {
      logEmailSync('google_refresh_failed', {
        accountId: account.id,
        userId: opts?.userId,
        status: res.status,
        error: data?.error,
        error_description: data?.error_description,
      })
      return null
    }

    const expiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString()
    const updatePayload: Record<string, unknown> = {
      google_access_token_enc: encryptOAuthToken(data.access_token),
      google_token_expiry: expiry,
      token_encryption_alg: 'aes-256-gcm',
    }
    if (data.refresh_token) updatePayload.google_refresh_token_enc = encryptOAuthToken(data.refresh_token)

    const updateQuery = account.id === 'legacy'
      ? supabase.from('user_profiles').update(updatePayload).eq('id', opts?.userId)
      : supabase.from('connected_email_accounts').update(updatePayload).eq('id', account.id)
    const { error: updateError } = await updateQuery
    if (updateError) {
      logEmailSync('google_refresh_persist_failed', {
        accountId: account.id,
        userId: opts?.userId,
        message: updateError.message,
        code: updateError.code,
      })
      return null
    }

    account.google_access_token_enc = updatePayload.google_access_token_enc
    if (updatePayload.google_refresh_token_enc) account.google_refresh_token_enc = updatePayload.google_refresh_token_enc
    account.google_token_expiry = expiry

    return data.access_token
  } catch (error) {
    logEmailSync('google_refresh_exception', { accountId: account.id, userId: opts?.userId, error: (error as Error).message })
    return null
  }
}

export async function refreshMicrosoftToken(supabase: any, account: any): Promise<string | null> {
  const refreshToken = decryptOAuthTokenSafe(account.ms_refresh_token_enc)
  if (!refreshToken) return null

  const existing = decryptOAuthTokenSafe(account.ms_access_token_enc)
  const expiryMs = account.ms_token_expiry ? new Date(account.ms_token_expiry).getTime() : 0
  if (existing && (!expiryMs || expiryMs > Date.now() + TOKEN_REFRESH_BUFFER_MS)) return existing

  try {
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.AZURE_CLIENT_ID!,
        client_secret: process.env.AZURE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
        scope:         'Mail.Read Mail.Send Calendars.Read User.Read offline_access',
      }),
    })

    const data = await res.json()
    if (!res.ok || !data.access_token) {
      logEmailSync('microsoft_refresh_failed', {
        accountId: account.id,
        status: res.status,
        error: data?.error,
        error_description: data?.error_description,
      })
      return null
    }

    const expiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString()
    const updatePayload: Record<string, unknown> = {
      ms_access_token_enc: encryptOAuthToken(data.access_token),
      ms_token_expiry: expiry,
      token_encryption_alg: 'aes-256-gcm',
    }
    if (data.refresh_token) updatePayload.ms_refresh_token_enc = encryptOAuthToken(data.refresh_token)

    const { error: updateError } = await supabase.from('connected_email_accounts').update(updatePayload).eq('id', account.id)
    if (updateError) {
      logEmailSync('microsoft_refresh_persist_failed', {
        accountId: account.id,
        message: updateError.message,
        code: updateError.code,
      })
      return null
    }

    account.ms_access_token_enc = updatePayload.ms_access_token_enc
    if (updatePayload.ms_refresh_token_enc) account.ms_refresh_token_enc = updatePayload.ms_refresh_token_enc
    account.ms_token_expiry = expiry

    return data.access_token
  } catch (error) {
    logEmailSync('microsoft_refresh_exception', { accountId: account.id, error: (error as Error).message })
    return null
  }
}

export async function getValidToken(supabase: any, account: any, userId: string): Promise<string | null> {
  const buf = TOKEN_REFRESH_BUFFER_MS
  if (account.provider === 'google') {
    const exp = account.google_token_expiry ? new Date(account.google_token_expiry) : null
    const currentAccess = decryptOAuthTokenSafe(account.google_access_token_enc)
    if (currentAccess && (!exp || exp > new Date(Date.now() + buf))) return currentAccess
    return refreshGoogleToken(supabase, account, { userId })
  }
  if (account.provider === 'microsoft') {
    const exp = account.ms_token_expiry ? new Date(account.ms_token_expiry) : null
    const currentAccess = decryptOAuthTokenSafe(account.ms_access_token_enc)
    if (currentAccess && (!exp || exp > new Date(Date.now() + buf))) return currentAccess
    return refreshMicrosoftToken(supabase, account)
  }
  return null
}

async function triageEmail(
  subject: string, from: string, snippet: string,
  context: string, domainOverride: string | null,
  receiptEnabled: boolean, receiptKeywords: string[]
) {
  const text = `${subject} ${snippet}`.toLowerCase()
  const looksLikeReceipt = receiptEnabled && receiptKeywords.some(kw => text.includes(kw.toLowerCase()))
  const domainHint = domainOverride
    ? `Force domain to '${domainOverride}'.`
    : `Email from ${context} inbox. Bias domain accordingly.`
  const TRIAGE_CLASSES = ['urgent','opportunity','file_doc','meeting','fyi','personal','junk']
  const system = `PIOS email triage for a senior FM consultant and SaaS founder. ${domainHint}
Return ONLY valid JSON: {"domain":"${domainOverride ?? DOMAINS.join('|')}","triage_class":"${TRIAGE_CLASSES.join('|')}","priority_score":1-10,"action_required":"string or null","ai_draft_reply":"string or null","is_meeting":true/false,"is_receipt":true/false,"receipt_data":{"vendor":"","amount":0,"currency":"GBP","date":"","invoice_no":""} or null}
triage_class rules: urgent=needs reply within 24h, opportunity=business/career opportunity, file_doc=document/contract/invoice to file, meeting=calendar invite/meeting request/RSVP, fyi=informational no action, personal=personal/family, junk=marketing/spam
Set is_meeting=true if the email contains a meeting invite, calendar event, RSVP request, meeting update, or meeting cancellation.`
  try {
    const raw = await callClaude(
      [{ role: 'user', content: `Subject: ${subject}\nFrom: ${from}\nSnippet: ${snippet}` }],
      system, 400
    )
    const p = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return {
      domain:         domainOverride ?? (DOMAINS.includes(p.domain) ? p.domain : 'personal'),
      triage_class:   TRIAGE_CLASSES.includes(p.triage_class) ? p.triage_class : null,
      is_meeting:     !!p.is_meeting,
      priority_score: Math.min(10, Math.max(1, parseInt(p.priority_score) || 3)),
      action_required: p.action_required || null,
      ai_draft_reply:  p.ai_draft_reply  || null,
      is_receipt:      !!p.is_receipt,
      receipt_data:    p.receipt_data    || null,
    }
  } catch {
    return { domain: domainOverride ?? 'personal', triage_class: null, is_meeting: false, priority_score: 3, action_required: null, ai_draft_reply: null, is_receipt: looksLikeReceipt, receipt_data: null }
  }
}
async function autoCreateExpense(supabase: any, userId: string, rd: any, domain: string, subject: string) {
  if (!rd?.amount || parseFloat(rd.amount) <= 0) return
  const desc = `${rd.vendor ?? 'Unknown'} — auto from email`
  const date = rd.date ?? new Date().toISOString().slice(0, 10)
  const { data: exists } = await supabase.from('expenses').select('id')
    .eq('user_id', userId).eq('description', desc).eq('date', date).maybeSingle()
  if (exists) return
  await supabase.from('expenses').insert({
    user_id: userId, description: desc,
    amount: parseFloat(rd.amount), currency: rd.currency ?? 'GBP',
    category: 'other', domain: domain === 'academic' ? 'academic' : 'business',
    date, notes: `Auto-extracted. Invoice: ${rd.invoice_no ?? '—'}. Subject: ${subject}`,
    updated_at: new Date().toISOString(),
  })
}
export async function syncGmail(supabase: any, userId: string, account: any, max: number) {
  let token = await getValidToken(supabase, account, userId)
  if (!token) {
    if (account.id !== 'legacy') {
      await supabase.from('connected_email_accounts').update({ last_sync_error: 'Token expired — reconnect required' }).eq('id', account.id)
    }
    return { synced: 0, receipts: 0, blocked: 0, error: 'Token expired' }
  }

  const fetchList = async (bearer: string) => fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&q=is:unread+-category:promotions`,
    { headers: { Authorization: `Bearer ${bearer}` } },
  )

  let res = await fetchList(token)
  if (res.status === 401) {
    logEmailSync('gmail_401_refresh_attempt', { accountId: account.id, userId })
    const refreshed = await refreshGoogleToken(supabase, account, { force: true, userId })
    if (!refreshed) {
      if (account.id !== 'legacy') {
        await supabase.from('connected_email_accounts').update({ last_sync_error: 'Token expired — reconnect required' }).eq('id', account.id)
      }
      return { synced: 0, receipts: 0, blocked: 0, error: 'Token refresh failed after 401' }
    }
    token = refreshed
    res = await fetchList(token)
  }

  if (!res.ok) return { synced: 0, receipts: 0, blocked: 0, error: `Gmail ${res.status}` }

  const { messages = [] } = await res.json()

  // Load blocked senders for this user
  const { data: blockedList } = await supabase
    .from('blocked_senders')
    .select('email, domain')
    .eq('user_id', userId)
  const blockedEmails = new Set((blockedList ?? []).map((b: any) => b.email?.toLowerCase()))
  const blockedDomains = new Set((blockedList ?? []).map((b: any) => b.domain?.toLowerCase()).filter(Boolean))

  // Load email filters
  const { data: filterRules } = await supabase
    .from('email_filters')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('priority')

  let synced = 0, receipts = 0, blocked = 0
  for (const msg of messages.slice(0, max)) {
    const dr = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=List-Unsubscribe`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!dr.ok) continue

    const d = await dr.json()
    const h: Record<string, string> = {}
    d.payload?.headers?.forEach((x: Record<string, unknown>) => { h[String(x.name ?? '')] = String(x.value ?? '') })
    const subject = h.Subject ?? '(no subject)', from = h.From ?? '', snippet = d.snippet ?? ''
    const senderEmail = (from.match(/<(.+)>/)?.[1] ?? from).toLowerCase()
    const senderDomain = senderEmail.split('@')[1] ?? ''

    // Extract unsubscribe URL from List-Unsubscribe header
    const unsubHeader = h['List-Unsubscribe'] ?? ''
    const unsubscribeUrl = unsubHeader.match(/<(https?:\/\/[^>]+)>/)?.[1] ?? null

    // Check if sender is blocked
    if (blockedEmails.has(senderEmail) || blockedDomains.has(senderDomain)) {
      // Auto-spam blocked senders
      await supabase.from('email_items').upsert({
        user_id: userId, account_id: account.id,
        gmail_message_id: msg.id, gmail_thread_id: d.threadId,
        subject, sender_name: from.split('<')[0].trim(), sender_email: senderEmail,
        received_at: new Date(parseInt(d.internalDate)).toISOString(), snippet,
        status: 'spam', is_blocked: true, is_spam: true,
        unsubscribe_url: unsubscribeUrl,
        inbox_context: account.context, inbox_label: account.label ?? account.display_name,
      }, { onConflict: 'gmail_message_id' })
      blocked++
      continue
    }

    const t = await triageEmail(subject, from, snippet, account.context, account.ai_domain_override, account.receipt_scan_enabled, account.receipt_keywords ?? [])
    if (t.is_receipt) { receipts++; await autoCreateExpense(supabase, userId, t.receipt_data, t.domain, subject) }

    // Apply user email filters
    let filterStatus = 'triaged'
    let filterFlagged = false
    let filterSpam = false
    for (const rule of filterRules ?? []) {
      const matchVal = rule.match_value?.toLowerCase() ?? ''
      let target = ''
      if (rule.match_field === 'from') target = senderEmail
      else if (rule.match_field === 'subject') target = subject.toLowerCase()
      else if (rule.match_field === 'contains') target = `${subject} ${snippet}`.toLowerCase()
      else if (rule.match_field === 'domain') target = senderDomain
      else if (rule.match_field === 'to') target = (account.email_address ?? '').toLowerCase()

      let matched = false
      if (rule.match_mode === 'exact') matched = target === matchVal
      else if (rule.match_mode === 'starts_with') matched = target.startsWith(matchVal)
      else if (rule.match_mode === 'ends_with') matched = target.endsWith(matchVal)
      else matched = target.includes(matchVal)

      if (matched) {
        if (rule.action === 'archive') filterStatus = 'archived'
        if (rule.action === 'spam') { filterStatus = 'spam'; filterSpam = true }
        if (rule.action === 'delete') filterStatus = 'deleted'
        if (rule.action === 'flag') filterFlagged = true
        if (rule.action === 'block') {
          await supabase.from('blocked_senders').upsert({
            user_id: userId, email: senderEmail, domain: senderDomain, reason: `Filter: ${rule.name}`,
          }, { onConflict: 'user_id,email' })
          filterStatus = 'spam'; filterSpam = true
        }
        break // first matching rule wins
      }
    }

    await supabase.from('email_items').upsert({
      user_id: userId, account_id: account.id, inbox_context: account.context,
      inbox_label: account.label ?? account.display_name,
      gmail_message_id: msg.id, gmail_thread_id: d.threadId,
      subject, sender_name: from.split('<')[0].trim(), sender_email: senderEmail,
      received_at: new Date(parseInt(d.internalDate)).toISOString(), snippet,
      domain_tag: t.domain, triage_class: t.triage_class, priority_score: t.priority_score,
      action_required: t.action_required, ai_draft_reply: t.ai_draft_reply,
      is_receipt: t.is_receipt, receipt_data: t.receipt_data,
      unsubscribe_url: unsubscribeUrl,
      is_flagged: filterFlagged, is_spam: filterSpam,
      status: filterStatus,
    }, { onConflict: 'gmail_message_id' })
    synced++
  }

  if (account.id !== 'legacy') {
    await supabase.from('connected_email_accounts')
      .update({ last_synced_at: new Date().toISOString(), last_sync_error: null }).eq('id', account.id)
  }

  return { synced, receipts, blocked }
}
export async function syncMicrosoft(supabase: any, userId: string, account: any, token: string, max: number) {
  const url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=${max}&$filter=isRead eq false&$select=id,subject,from,receivedDateTime,bodyPreview,conversationId`
  const fetchList = (bearer: string) => fetch(url, { headers: { Authorization: `Bearer ${bearer}` } })

  let res = await fetchList(token)
  if (res.status === 401) {
    logEmailSync('microsoft_401_refresh_attempt', { accountId: account.id, userId })
    const refreshed = await refreshMicrosoftToken(supabase, account)
    if (!refreshed) {
      await supabase.from('connected_email_accounts').update({ last_sync_error: 'Token expired — reconnect required' }).eq('id', account.id)
      return { synced: 0, receipts: 0, error: 'Token refresh failed after 401' }
    }
    token = refreshed
    res = await fetchList(token)
  }

  if (!res.ok) { const e = await res.text(); return { synced: 0, receipts: 0, error: `Graph ${res.status}: ${e.slice(0,100)}` } }
  const { value: messages = [] } = await res.json()
  let synced = 0, receipts = 0
  for (const msg of messages.slice(0, max)) {
    const subject = msg.subject ?? '(no subject)'
    const fromName  = msg.from?.emailAddress?.name    ?? ''
    const fromEmail = msg.from?.emailAddress?.address ?? ''
    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail
    const snippet = msg.bodyPreview ?? ''
    const t = await triageEmail(subject, from, snippet, account.context, account.ai_domain_override, account.receipt_scan_enabled, account.receipt_keywords ?? [])
    if (t.is_receipt) { receipts++; await autoCreateExpense(supabase, userId, t.receipt_data, t.domain, subject) }
    await supabase.from('email_items').upsert({
      user_id: userId, account_id: account.id, inbox_context: account.context,
      inbox_label: account.label ?? account.display_name,
      gmail_message_id: `ms:${msg.id}`, gmail_thread_id: msg.conversationId ?? null,
      subject, sender_name: fromName, sender_email: fromEmail,
      received_at: msg.receivedDateTime, snippet,
      domain_tag: t.domain, triage_class: t.triage_class, priority_score: t.priority_score,
      action_required: t.action_required, ai_draft_reply: t.ai_draft_reply,
      is_receipt: t.is_receipt, receipt_data: t.receipt_data, status: 'triaged',
    }, { onConflict: 'gmail_message_id' })
    synced++
  }
  await supabase.from('connected_email_accounts')
    .update({ last_synced_at: new Date().toISOString(), last_sync_error: null }).eq('id', account.id)
  return { synced, receipts }
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string,unknown> = {}
  try { body = await req.json() } catch { /**/ }
  const targetId = body.account_id ?? null
  const max = Math.min(parseInt(String(body.max_per_acct ?? '15')), 50)
  let q = supabase.from('connected_email_accounts').select('*')
    .eq('user_id', user.id).eq('is_active', true).eq('sync_enabled', true)
  if (targetId) q = q.eq('id', targetId)
  const { data: accounts } = await q
  if (!accounts || accounts.length === 0) {
    const { data: profile } = await supabase.from('user_profiles')
      .select('google_access_token_enc,google_refresh_token_enc,google_token_expiry').eq('id', user.id).single()
    if (!profile?.google_access_token_enc) return NextResponse.json({ synced: 0, receipts: 0, message: 'No email accounts connected. Add one in Settings → Email Accounts.' })
    const legacyAcc = { id: 'legacy', provider: 'google', context: 'personal', label: 'Gmail', display_name: 'Gmail', ai_domain_override: null, receipt_scan_enabled: false, receipt_keywords: [], ...profile }
    const r = await syncGmail(supabase, user.id, legacyAcc, max)
    return NextResponse.json({ ...r, accounts_synced: 1 })
  }
  const results = await Promise.allSettled(accounts.map(async (acc: any) => {
    logEmailSync('account_sync_started', { userId: user.id, accountId: acc.id, provider: acc.provider, email: acc.email_address })

    if (acc.provider === 'google') {
      const r = await syncGmail(supabase, user.id, acc, max)
      logEmailSync('account_sync_finished', { userId: user.id, accountId: acc.id, provider: acc.provider, synced: r.synced, receipts: r.receipts, error: r.error ?? null })
      return { account_id: acc.id, email: acc.email_address, ...r }
    }

    if (acc.provider === 'microsoft') {
      const token = await getValidToken(supabase, acc, user.id)
      if (!token) {
        await supabase.from('connected_email_accounts').update({ last_sync_error: 'Token expired — reconnect required' }).eq('id', acc.id)
        logEmailSync('account_sync_finished', { userId: user.id, accountId: acc.id, provider: acc.provider, synced: 0, receipts: 0, error: 'Token expired' })
        return { account_id: acc.id, email: acc.email_address, synced: 0, receipts: 0, error: 'Token expired' }
      }
      const r = await syncMicrosoft(supabase, user.id, acc, token, max)
      if (r.error) {
        await supabase.from('connected_email_accounts').update({ last_sync_error: r.error }).eq('id', acc.id)
      }
      logEmailSync('account_sync_finished', { userId: user.id, accountId: acc.id, provider: acc.provider, synced: r.synced, receipts: r.receipts, error: r.error ?? null })
      return { account_id: acc.id, email: acc.email_address, ...r }
    }

    return { account_id: acc.id, email: acc.email_address, synced: 0, receipts: 0, error: 'IMAP coming soon' }
  }))
  const detail = results.map((r: any) => r.status === 'fulfilled' ? (r as any).value : { error: String(r.reason) })
  return NextResponse.json({
    synced:          detail.reduce((s: number, r: any) => s + (r?.synced ?? 0), 0),
    receipts:        detail.reduce((s: number, r: any) => s + (r?.receipts ?? 0), 0),
    accounts_synced: accounts.length,
    detail,
  })
}
