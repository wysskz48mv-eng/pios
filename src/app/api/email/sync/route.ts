/**
 * POST /api/email/sync
 * Syncs emails from ALL connected accounts (Google + Microsoft Graph).
 * PIOS v3.0 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { callClaude }                from '@/lib/ai/client'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

export const runtime = 'nodejs'
export const maxDuration = 60

const DOMAINS = ['academic','fm_consulting','saas','business','personal']
async function refreshGoogleToken(supabase: any, account: any): Promise<string | null> {
  if (!account.google_refresh_token_enc) return null
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: account.google_refresh_token_enc,
        grant_type:    'refresh_token',
      }),
    })
    const data = await res.json()
    if (!data.access_token) return null
    const expiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString()
    await supabase.from('connected_email_accounts')
      .update({ google_access_token_enc: data.access_token, google_token_expiry: expiry })
      .eq('id', account.id)
    return data.access_token
  } catch { return null }
}
async function refreshMicrosoftToken(supabase: any, account: any): Promise<string | null> {
  if (!account.ms_refresh_token_enc) return null
  try {
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.AZURE_CLIENT_ID!,
        client_secret: process.env.AZURE_CLIENT_SECRET!,
        refresh_token: account.ms_refresh_token_enc,
        grant_type:    'refresh_token',
        scope:         'Mail.Read Mail.Send Calendars.Read User.Read offline_access',
      }),
    })
    const data = await res.json()
    if (!data.access_token) return null
    const expiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString()
    await supabase.from('connected_email_accounts')
      .update({ ms_access_token_enc: data.access_token, ms_token_expiry: expiry })
      .eq('id', account.id)
    return data.access_token
  } catch { return null }
}
async function getValidToken(supabase: any, account: any): Promise<string | null> {
  const buf = 5 * 60 * 1000
  if (account.provider === 'google') {
    const exp = account.google_token_expiry ? new Date(account.google_token_expiry) : null
    if (exp && exp > new Date(Date.now() + buf)) return account.google_access_token_enc
    return refreshGoogleToken(supabase, account)
  }
  if (account.provider === 'microsoft') {
    const exp = account.ms_token_expiry ? new Date(account.ms_token_expiry) : null
    if (exp && exp > new Date(Date.now() + buf)) return account.ms_access_token_enc
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
async function syncGmail(supabase: any, userId: string, account: any, token: string, max: number) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&q=is:unread+-category:promotions`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
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
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!dr.ok) continue
    const d = await dr.json()
    const h: Record<string, string> = {}
    d.payload?.headers?.forEach((x: Record<string, unknown>) => { h[String(x.name ?? "")] = String(x.value ?? "") })
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
  await supabase.from('connected_email_accounts')
    .update({ last_synced_at: new Date().toISOString(), last_sync_error: null }).eq('id', account.id)
  return { synced, receipts, blocked }
}
async function syncMicrosoft(supabase: any, userId: string, account: any, token: string, max: number) {
  const url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=${max}&$filter=isRead eq false&$select=id,subject,from,receivedDateTime,bodyPreview,conversationId`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
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
    const token = await getValidToken(supabase, legacyAcc)
    if (!token) return NextResponse.json({ synced: 0, receipts: 0, error: 'Google inbox token expired. Reconnect it in Settings → Email Accounts.' })
    const r = await syncGmail(supabase, user.id, legacyAcc, token, max)
    return NextResponse.json({ ...r, accounts_synced: 1 })
  }
  const results = await Promise.allSettled(accounts.map(async (acc: any) => {
    const token = await getValidToken(supabase, acc)
    if (!token) { await supabase.from('connected_email_accounts').update({ last_sync_error: 'Token expired — reconnect' }).eq('id', acc.id); return { account_id: acc.id, email: acc.email_address, synced: 0, receipts: 0, error: 'Token expired' } }
    const r = acc.provider === 'google' ? await syncGmail(supabase, user.id, acc, token, max) :
              acc.provider === 'microsoft' ? await syncMicrosoft(supabase, user.id, acc, token, max) :
              { synced: 0, receipts: 0, error: 'IMAP coming soon' }
    return { account_id: acc.id, email: acc.email_address, ...r }
  }))
  const detail = results.map((r: any) => r.status === 'fulfilled' ? (r as any).value : { error: String(r.reason) })
  return NextResponse.json({
    synced:          detail.reduce((s: number, r: any) => s + (r?.synced ?? 0), 0),
    receipts:        detail.reduce((s: number, r: any) => s + (r?.receipts ?? 0), 0),
    accounts_synced: accounts.length,
    detail,
  })
}
