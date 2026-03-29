import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/email/triage
 * Multi-inbox email triage + draft agent.
 *
 * CRITICAL DESIGN RULE:
 *   Draft is ALWAYS created from the SAME inbox the email arrived in.
 *   email@veritasiq.io receives → draft created from email@veritasiq.io
 *   d.masuku@aecom.com receives → draft created from d.masuku@aecom.com
 *   dmasuku@gmail.com receives → draft created from dmasuku@gmail.com
 *
 * HUMAN-IN-THE-LOOP GUARANTEE:
 *   Agent NEVER sends. Draft saved to Gmail draft folder + PIOS email_drafts.
 *   User reviews, edits, sends from Gmail or PIOS Inbox.
 *
 * Flow per email:
 *   1. Read email_items.inbox_address → find matching connected_email_accounts row
 *   2. Classify: urgent | opportunity | file_doc | fyi | junk | personal
 *   3. If actionable: NemoClaw™ drafts reply in user's register
 *   4. Create Gmail draft via API using THAT account's OAuth token
 *   5. Store draft in email_drafts table with gmail_draft_id
 *   6. Create task if urgent, log decision if opportunity
 *   7. Update email_items.triage_class + triage_at
 *
 * VeritasIQ Technologies Ltd · PIOS Sprint K
 */

export const dynamic     = 'force-dynamic'
export const maxDuration = 60

/* ── Types ─────────────────────────────────────────────────── */
type EmailClass = 'urgent' | 'opportunity' | 'file_doc' | 'fyi' | 'junk' | 'personal'

interface EmailItem {
  id: string
  user_id: string
  inbox_address: string      // WHICH inbox received this email
  from_address: string
  from_name?: string
  subject?: string
  body_text?: string
  body_preview?: string
  received_at: string
  thread_id?: string
  gmail_message_id?: string
  triage_class?: string
  provider?: string
}

interface ConnectedAccount {
  id: string
  email_address: string
  provider: string
  access_token: string
  refresh_token: string
  inbox_type: string        // business | personal | academic | employer
  triage_enabled: boolean
}

/* ── Main handler ─────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const emailIds: string[] = body.email_ids ?? []

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Load NemoClaw profile
  const { data: calib } = await admin
    .from('nemoclaw_calibration')
    .select('calibration_summary,communication_register,seniority_level,primary_industry,employers')
    .eq('user_id', user.id)
    .single()

  const { data: profile } = await admin
    .from('user_profiles')
    .select('full_name')
    .eq('user_id', user.id)
    .single()

  const userName = profile?.full_name ?? user.email?.split('@')[0] ?? 'there'

  // Load ALL connected accounts for this user — keyed by email address
  const { data: accounts } = await admin
    .from('connected_email_accounts')
    .select('id,email_address,provider,access_token,refresh_token,inbox_type,triage_enabled')
    .eq('user_id', user.id)
    .eq('triage_enabled', true)

  const accountMap = new Map<string, ConnectedAccount>()
  for (const acc of (accounts ?? [])) {
    accountMap.set(acc.email_address.toLowerCase(), acc as ConnectedAccount)
  }

  // Load unprocessed emails
  let emailQuery = admin
    .from('email_items')
    .select('*')
    .eq('user_id', user.id)
    .is('triage_class', null)
    .order('received_at', { ascending: false })
    .limit(20)

  if (emailIds.length > 0) {
    emailQuery = admin
      .from('email_items')
      .select('*')
      .eq('user_id', user.id)
      .in('id', emailIds)
  }

  const { data: emails } = await emailQuery as { data: EmailItem[] | null }
  if (!emails?.length) {
    return NextResponse.json({ ok: true, processed: 0, message: 'No emails to triage' })
  }

  const client   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const results: Record<string, string> = {}

  for (const email of emails) {
    try {
      // CRITICAL: find account matching the inbox the email arrived in
      const inboxAddr = (email.inbox_address ?? '').toLowerCase()
      const account   = accountMap.get(inboxAddr)

      if (!account) {
        // Inbox not connected — classify only, no draft
        const classification = await classifyEmail(email, calib, client)
        await admin.from('email_items').update({
          triage_class: classification.class,
          triage_at:    new Date().toISOString(),
          triage_note:  'Classified only — inbox not connected for drafting',
        }).eq('id', email.id)
        results[email.id] = `classified: ${classification.class} (no draft — inbox not connected)`
        continue
      }

      // Full triage + draft
      const result = await triageAndDraft({
        email, account, calib, userName, client, admin, userId: user.id,
      })
      results[email.id] = result

    } catch (err) {
      results[email.id] = `error: ${err instanceof Error ? err.message : 'unknown'}`
    }
  }

  return NextResponse.json({ ok: true, processed: emails.length, results })
}

/* ── Full triage + draft for one email ─────────────────────── */
async function triageAndDraft({
  email, account, calib, userName, client, admin, userId,
}: {
  email:    EmailItem
  account:  ConnectedAccount
  calib:    Record<string, unknown> | null
  userName: string
  client:   Anthropic
  admin:    ReturnType<typeof createAdmin>
  userId:   string
}): Promise<string> {

  // Step 1: Classify
  const classification = await classifyEmail(email, calib, client)
  const cls = classification.class as EmailClass

  // Step 2: If junk or FYI with no action needed — just classify and move on
  if (cls === 'junk') {
    await admin.from('email_items').update({
      triage_class: 'junk',
      triage_at:    new Date().toISOString(),
      triage_note:  classification.reasoning,
    }).eq('id', email.id)
    return 'junk — archived'
  }

  // Step 3: Draft reply if actionable
  let draftId: string | null   = null
  let draftBody: string | null = null

  if (['urgent', 'opportunity', 'personal'].includes(cls)) {
    // Generate NemoClaw™ draft using the CORRECT inbox context
    draftBody = await generateDraft({
      email, account, calib, userName, classification, client,
    })

    // Create Gmail draft from the CORRECT account
    if (draftBody && account.provider === 'gmail' && account.access_token) {
      draftId = await createGmailDraft({
        accessToken:  account.access_token,
        refreshToken: account.refresh_token,
        fromAddress:  account.email_address,   // ← CORRECT inbox
        toAddress:    email.from_address,
        subject:      replySubject(email.subject ?? ''),
        bodyText:     draftBody,
        threadId:     email.thread_id,
      })
    }

    // Store draft in PIOS for review in Inbox page
    await admin.from('email_drafts').upsert({
      user_id:         userId,
      email_item_id:   email.id,
      from_address:    account.email_address,   // ← CORRECT inbox
      to_address:      email.from_address,
      subject:         replySubject(email.subject ?? ''),
      body:            draftBody,
      gmail_draft_id:  draftId,
      inbox_address:   account.email_address,
      triage_class:    cls,
      status:          'draft',
      ai_generated:    true,
      created_at:      new Date().toISOString(),
    }, { onConflict: 'email_item_id' })
  }

  // Step 4: Side effects based on classification
  if (cls === 'urgent') {
    await admin.from('tasks').insert({
      user_id:     userId,
      title:       `Reply: ${email.subject ?? 'Email from ' + email.from_name}`,
      description: `From: ${email.from_address}\nPreview: ${email.body_preview ?? ''}`,
      priority:    'high',
      status:      'todo',
      domain:      mapInboxToDomain(account.inbox_type),
      due_date:    new Date(Date.now() + 86400000).toISOString(),
      source:      'email_triage',
      created_at:  new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    })
  }

  if (cls === 'opportunity') {
    await admin.from('executive_decisions').insert({
      user_id:    userId,
      title:      `Opportunity: ${email.subject ?? 'From ' + email.from_name}`,
      context:    `Email from ${email.from_address}.\n\n${classification.reasoning}`,
      status:     'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  // Step 5: Update email_items
  await admin.from('email_items').update({
    triage_class:  cls,
    triage_at:     new Date().toISOString(),
    triage_note:   classification.reasoning,
    draft_created: !!draftId,
    gmail_draft_id: draftId,
  }).eq('id', email.id)

  return `${cls} → draft ${draftId ? `created in Gmail (${account.email_address})` : 'stored in PIOS'}`
}

/* ── NemoClaw™ email classification ────────────────────────── */
async function classifyEmail(
  email: EmailItem,
  calib: Record<string, unknown> | null,
  client: Anthropic,
): Promise<{ class: EmailClass; reasoning: string; urgency: number }> {

  const prompt = `Classify this email for a ${calib?.seniority_level ?? 'senior'} professional in ${calib?.primary_industry ?? 'consulting'}.

FROM: ${email.from_address} ${email.from_name ? `(${email.from_name})` : ''}
SUBJECT: ${email.subject ?? '(no subject)'}
PREVIEW: ${email.body_preview ?? email.body_text?.slice(0, 500) ?? '(no content)'}
INBOX: ${email.inbox_address}

Classify as exactly ONE of:
- urgent: needs reply within 24h, action required, time-sensitive
- opportunity: potential business/career/commercial opportunity
- file_doc: document, contract, invoice, attachment to save
- fyi: useful information, no action needed
- junk: marketing, newsletter, automated, spam
- personal: personal/family, low urgency

Respond in JSON only:
{"class": "urgent|opportunity|file_doc|fyi|junk|personal", "reasoning": "one sentence", "urgency": 1-10}`

  const msg = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages:   [{ role: 'user', content: prompt }],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return { class: 'fyi', reasoning: 'Classification failed — defaulted to FYI', urgency: 3 }
  }
}

/* ── NemoClaw™ draft generation ────────────────────────────── */
async function generateDraft({
  email, account, calib, userName, classification, client,
}: {
  email:          EmailItem
  account:        ConnectedAccount
  calib:          Record<string, unknown> | null
  userName:       string
  classification: { class: string; reasoning: string }
  client:         Anthropic
}): Promise<string> {

  // Inbox type affects tone — employer inbox is more formal than personal
  const inboxContext = {
    business:  'This is a business inbox. Professional, direct tone.',
    employer:  'This is an employer/work inbox. Formal, corporate tone.',
    personal:  'This is a personal inbox. Warm but still professional.',
    academic:  'This is a university inbox. Scholarly, structured tone.',
  }[account.inbox_type] ?? 'Professional tone.'

  const system = `You are NemoClaw™, drafting an email reply for ${userName}.
PROFILE: ${calib?.calibration_summary ?? 'Senior professional'}
REGISTER: ${calib?.communication_register ?? 'professional'}
INBOX CONTEXT: ${inboxContext}
SENDING FROM: ${account.email_address}

Rules:
- Write ONLY the email body — no subject line, no "From:", no metadata
- Match the user's communication register exactly
- UK English, British spellings
- Direct and concise — no padding
- Do NOT include a sign-off (user will add their own)
- This is a DRAFT for human review — not a final send`

  const user_prompt = `Draft a reply to this email:

FROM: ${email.from_name ?? email.from_address} <${email.from_address}>
SUBJECT: ${email.subject}
MESSAGE:
${email.body_text?.slice(0, 1500) ?? email.body_preview ?? '(no content)'}

CLASSIFICATION: ${classification.class} — ${classification.reasoning}

Write a reply that:
${classification.class === 'urgent' ? '- Acknowledges urgency, commits to timeline, requests any missing info' : ''}
${classification.class === 'opportunity' ? '- Expresses appropriate interest, asks qualifying questions, proposes next step' : ''}
${classification.class === 'personal' ? '- Responds warmly and appropriately to the personal context' : ''}

Keep it under 150 words unless more detail is clearly needed.`

  const msg = await client.messages.create({
    model:      'claude-sonnet-4-5-20251001',
    max_tokens: 600,
    system,
    messages:   [{ role: 'user', content: user_prompt }],
  })

  return msg.content[0].type === 'text' ? msg.content[0].text : ''
}

/* ── Gmail draft creation ───────────────────────────────────── */
async function createGmailDraft({
  accessToken, refreshToken, fromAddress, toAddress,
  subject, bodyText, threadId,
}: {
  accessToken:  string
  refreshToken: string
  fromAddress:  string   // ← the inbox the original email arrived in
  toAddress:    string
  subject:      string
  bodyText:     string
  threadId?:    string
}): Promise<string | null> {

  try {
    // Refresh token if needed
    let token = accessToken
    if (!token && refreshToken) {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     process.env.GOOGLE_CLIENT_ID ?? '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
          refresh_token: refreshToken,
          grant_type:    'refresh_token',
        }),
      })
      const refreshData = await refreshRes.json()
      token = refreshData.access_token
    }

    if (!token) return null

    // Build RFC 2822 MIME message
    // From MUST be the inbox that received the original email
    const mimeLines = [
      `From: ${fromAddress}`,
      `To: ${toAddress}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `MIME-Version: 1.0`,
      ``,
      bodyText,
    ]

    const mimeMessage = mimeLines.join('\r\n')
    const encoded     = Buffer.from(mimeMessage).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    // Create draft via Gmail API
    const body: Record<string, unknown> = { message: { raw: encoded } }
    if (threadId) body.message = { ...(body.message as object), threadId }

    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(fromAddress)}/drafts`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(body),
      }
    )

    if (!res.ok) {
      console.error('[gmail draft] API error:', res.status, await res.text())
      return null
    }

    const data = await res.json()
    return data.id ?? null   // Gmail draft ID

  } catch (err) {
    console.error('[gmail draft] error:', err)
    return null
  }
}

/* ── Helpers ────────────────────────────────────────────────── */
function replySubject(subject: string): string {
  if (subject.toLowerCase().startsWith('re:')) return subject
  return `Re: ${subject}`
}

function mapInboxToDomain(inboxType: string): string {
  return { business: 'business', employer: 'fm_consulting', personal: 'personal', academic: 'academic' }[inboxType] ?? 'business'
}
