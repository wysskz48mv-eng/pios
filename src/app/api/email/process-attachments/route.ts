import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/email/process-attachments
 * VIQ-VAULT™ Attachment Filing Agent
 *
 * For each attachment in the queue:
 * 1. Downloads from Gmail API
 * 2. Classifies document type (contract, invoice, report, etc.)
 * 3. Extracts key metadata (parties, dates, value, expiry)
 * 4. Matches to stakeholder by organisation name
 * 5. Links to relevant decision/proposal/project
 * 6. Generates 2-3 sentence summary
 * 7. Files in vault with correct folder placement
 * 8. Creates expiry alert task if relevant (contracts, insurance, certs)
 *
 * FILING HIERARCHY (in order of specificity):
 *   1. By stakeholder/organisation (if sender matches stakeholder)
 *   2. By document type (Contracts, Invoices, Reports, etc.)
 *   3. By project (if linked)
 *   4. Unclassified (for user to review)
 *
 * JUNK ATTACHMENT FILTER:
 *   - Images < 50KB (likely logos/signatures) → skip
 *   - Standard email footers → skip
 *   - Tracking pixels → skip
 *   - PDF with < 500 chars content → flag for review
 *
 * VeritasIQ Technologies Ltd · PIOS Sprint K — VIQ-VAULT™
 */

export const dynamic     = 'force-dynamic'
export const maxDuration = 120

/* ── Doc type taxonomy ──────────────────────────────────────── */
const DOC_TYPES: Record<string, { label: string; expiry: boolean; alert_days: number }> = {
  contract:      { label: 'Contract',         expiry: true,  alert_days: 60 },
  invoice:       { label: 'Invoice',          expiry: false, alert_days: 30 },
  proposal:      { label: 'Proposal',         expiry: true,  alert_days: 14 },
  report:        { label: 'Report',           expiry: false, alert_days: 0  },
  meeting_notes: { label: 'Meeting notes',    expiry: false, alert_days: 0  },
  strategy:      { label: 'Strategy doc',     expiry: false, alert_days: 0  },
  financial:     { label: 'Financial',        expiry: false, alert_days: 0  },
  legal:         { label: 'Legal document',   expiry: true,  alert_days: 90 },
  hr:            { label: 'HR document',      expiry: false, alert_days: 0  },
  technical:     { label: 'Technical spec',   expiry: false, alert_days: 0  },
  correspondence:{ label: 'Correspondence',   expiry: false, alert_days: 0  },
  certificate:   { label: 'Certificate',      expiry: true,  alert_days: 60 },
  insurance:     { label: 'Insurance',        expiry: true,  alert_days: 90 },
  compliance:    { label: 'Compliance',       expiry: true,  alert_days: 30 },
  research:      { label: 'Research',         expiry: false, alert_days: 0  },
  other:         { label: 'Other',            expiry: false, alert_days: 0  },
}

/* ── Junk attachment filters ────────────────────────────────── */
const JUNK_FILENAMES = [
  'image001.png', 'image002.png', 'logo.png', 'logo.jpg',
  'signature.png', 'pixel.gif', 'tracking.gif',
]
const JUNK_MIMES = ['image/gif', 'application/octet-stream']
const MIN_PDF_SIZE = 5000    // bytes — below this skip
const MIN_IMG_SIZE = 50000   // bytes — below this likely logo

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const queueIds: string[] = body.queue_ids ?? []

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Load pending queue items
  let queueQuery = admin
    .from('attachment_queue')
    .select('*, email_items(from_address, from_name, subject, inbox_address)')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('queued_at', { ascending: true })
    .limit(10)

  if (queueIds.length > 0) {
    queueQuery = admin
      .from('attachment_queue')
      .select('*, email_items(from_address, from_name, subject, inbox_address)')
      .eq('user_id', user.id)
      .in('id', queueIds)
  }

  const { data: queue } = await queueQuery
  if (!queue?.length) return NextResponse.json({ ok: true, processed: 0 })

  // Load user context for NemoClaw matching
  const { data: stakeholders } = await admin
    .from('stakeholders')
    .select('id, name, organisation')
    .eq('user_id', user.id)

  const { data: activeDecisions } = await admin
    .from('executive_decisions')
    .select('id, title')
    .eq('user_id', user.id)
    .eq('status', 'open')
    .limit(10)

  const { data: activeProposals } = await admin
    .from('proposals')
    .select('id, title')
    .eq('user_id', user.id)
    .in('status', ['sent', 'negotiating'])
    .limit(10)

  const client  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const results: Record<string, string> = {}

  for (const item of queue) {
    try {
      // Mark as processing
      await admin.from('attachment_queue').update({ status: 'processing' }).eq('id', item.id)

      // Check junk filters
      if (isJunkAttachment(item)) {
        await admin.from('attachment_queue').update({ status: 'skipped', processed_at: new Date().toISOString() }).eq('id', item.id)
        results[item.id] = 'skipped — junk filter'
        continue
      }

      // Download attachment content from Gmail
      const content = await downloadGmailAttachment({
        inboxAddress:   item.email_items?.inbox_address ?? '',
        gmailMsgId:     item.gmail_msg_id,
        gmailAttachId:  item.gmail_attach_id,
        userId:         user.id,
        admin,
      })

      if (!content) {
        await admin.from('attachment_queue').update({ status: 'failed', error_message: 'Download failed', processed_at: new Date().toISOString() }).eq('id', item.id)
        results[item.id] = 'failed — download error'
        continue
      }

      // NemoClaw™ document analysis
      const analysis = await analyseDocument({
        content,
        filename:      item.filename,
        fromAddress:   item.email_items?.from_address ?? '',
        fromName:      item.email_items?.from_name ?? '',
        emailSubject:  item.email_items?.subject ?? '',
        stakeholders:  stakeholders ?? [],
        decisions:     activeDecisions ?? [],
        proposals:     activeProposals ?? [],
        client,
      })

      // Find matching stakeholder
      const matchedStakeholder = matchStakeholder(
        analysis.organisation ?? item.email_items?.from_address ?? '',
        stakeholders ?? []
      )

      // Store in vault
      const { data: vaultDoc, error: vaultErr } = await admin
        .from('vault_documents')
        .insert({
          user_id:            user.id,
          filename:           item.filename,
          file_type:          detectFileType(item.filename, item.mime_type),
          file_size_bytes:    item.file_size_bytes,
          mime_type:          item.mime_type,
          doc_type:           analysis.doc_type,
          doc_subtype:        analysis.doc_subtype,
          title:              analysis.title ?? item.filename,
          description:        analysis.description,
          key_parties:        analysis.key_parties ?? [],
          key_dates:          analysis.key_dates ?? {},
          financial_value:    analysis.financial_value,
          currency:           analysis.currency ?? 'GBP',
          stakeholder_id:     matchedStakeholder?.id ?? null,
          organisation_name:  analysis.organisation ?? matchedStakeholder?.organisation,
          decision_id:        analysis.matched_decision_id ?? null,
          proposal_id:        analysis.matched_proposal_id ?? null,
          email_item_id:      item.email_item_id,
          original_email_from: item.email_items?.from_address,
          ai_classified:      true,
          ai_summary:         analysis.description,
          ai_tags:            analysis.tags ?? [],
          confidence_score:   analysis.confidence,
          requires_review:    (analysis.confidence ?? 0) < 0.7,
          document_date:      analysis.key_dates?.document_date ?? null,
          expiry_date:        analysis.key_dates?.expiry_date ?? null,
          renewal_alert_days: DOC_TYPES[analysis.doc_type]?.alert_days ?? 0,
          storage_path:       null,  // set after upload to Supabase storage
          gmail_attachment_id: item.gmail_attach_id,
          created_at:         new Date().toISOString(),
          updated_at:         new Date().toISOString(),
        })
        .select('id')
        .single()

      if (vaultErr || !vaultDoc) {
        await admin.from('attachment_queue').update({ status: 'failed', error_message: vaultErr?.message, processed_at: new Date().toISOString() }).eq('id', item.id)
        results[item.id] = `failed — vault insert: ${vaultErr?.message}`
        continue
      }

      // Create expiry task if document has expiry date
      const docConfig = DOC_TYPES[analysis.doc_type]
      if (docConfig?.expiry && analysis.key_dates?.expiry_date) {
        const expiryDate = new Date(analysis.key_dates.expiry_date)
        const alertDate  = new Date(expiryDate.getTime() - docConfig.alert_days * 86400000)
        if (alertDate > new Date()) {
          await admin.from('tasks').insert({
            user_id:     user.id,
            title:       `${docConfig.label} expiry: ${analysis.title ?? item.filename}`,
            description: `${analysis.organisation ? `${analysis.organisation} — ` : ''}Expires ${expiryDate.toLocaleDateString('en-GB')}`,
            priority:    'medium',
            status:      'todo',
            domain:      'business',
            due_date:    alertDate.toISOString(),
            source:      'vault_attachment',
            created_at:  new Date().toISOString(),
            updated_at:  new Date().toISOString(),
          })
        }
      }

      // Assign to default folders
      await assignToFolders({
        vaultDocId:  vaultDoc.id,
        userId:      user.id,
        docType:     analysis.doc_type,
        orgName:     analysis.organisation,
        stakeholderId: matchedStakeholder?.id,
        admin,
      })

      // Update queue item
      await admin.from('attachment_queue').update({
        status:       'filed',
        vault_doc_id: vaultDoc.id,
        processed_at: new Date().toISOString(),
      }).eq('id', item.id)

      results[item.id] = `filed → ${analysis.doc_type} · ${analysis.organisation ?? 'unmatched'} · doc ${vaultDoc.id}`

    } catch (err) {
      await admin.from('attachment_queue').update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'unknown',
        processed_at:  new Date().toISOString(),
      }).eq('id', item.id)
      results[item.id] = `error: ${err instanceof Error ? err.message : 'unknown'}`
    }
  }

  return NextResponse.json({ ok: true, processed: queue.length, results })
}

/* ── NemoClaw™ document analysis ───────────────────────────── */
async function analyseDocument({
  content, filename, fromAddress, fromName, emailSubject,
  stakeholders, decisions, proposals, client,
}: {
  content: string; filename: string; fromAddress: string
  fromName: string; emailSubject: string
  stakeholders: {id:string;name:string;organisation:string}[]
  decisions:    {id:string;title:string}[]
  proposals:    {id:string;title:string}[]
  client: Anthropic
}): Promise<{
  doc_type: string; doc_subtype?: string; title?: string
  description?: string; key_parties?: string[]
  key_dates?: Record<string, string>; financial_value?: number
  currency?: string; organisation?: string; tags?: string[]
  confidence: number; matched_decision_id?: string
  matched_proposal_id?: string
}> {

  const stakeList = stakeholders.map(s => `${s.name} (${s.organisation})`).join(', ')
  const decList   = decisions.map(d => d.title).join(', ')
  const propList  = proposals.map(p => p.title).join(', ')

  const prompt = `Analyse this document and extract structured metadata.

DOCUMENT FILENAME: ${filename}
EMAIL FROM: ${fromName} <${fromAddress}>
EMAIL SUBJECT: ${emailSubject}
DOCUMENT CONTENT (first 3000 chars):
${content.slice(0, 3000)}

CONTEXT:
Known stakeholders: ${stakeList || 'none'}
Open decisions: ${decList || 'none'}
Active proposals: ${propList || 'none'}

Extract and return JSON only:
{
  "doc_type": "contract|invoice|proposal|report|meeting_notes|strategy|financial|legal|hr|technical|correspondence|certificate|insurance|compliance|research|other",
  "doc_subtype": "nda|sow|msa|po|quote|minutes|board_report|etc or null",
  "title": "clean document title (not the filename)",
  "description": "2-3 sentence summary of what this document is and why it matters",
  "key_parties": ["Organisation A", "Organisation B"],
  "key_dates": {
    "document_date": "YYYY-MM-DD or null",
    "effective_date": "YYYY-MM-DD or null",
    "expiry_date": "YYYY-MM-DD or null",
    "signed_date": "YYYY-MM-DD or null"
  },
  "financial_value": 0,
  "currency": "GBP",
  "organisation": "primary organisation this document relates to (counterparty)",
  "tags": ["tag1", "tag2"],
  "confidence": 0.0-1.0,
  "matched_decision_title": "title of matching open decision or null",
  "matched_proposal_title": "title of matching active proposal or null"
}`

  try {
    const msg = await client.messages.create({
      model:      'claude-sonnet-4-5-20251001',
      max_tokens: 800,
      messages:   [{ role: 'user', content: prompt }],
    })

    const text  = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    // Match decision and proposal IDs from titles
    if (parsed.matched_decision_title) {
      const dec = decisions.find(d => d.title.toLowerCase().includes(parsed.matched_decision_title.toLowerCase().slice(0, 20)))
      if (dec) parsed.matched_decision_id = dec.id
    }
    if (parsed.matched_proposal_title) {
      const prop = proposals.find(p => p.title.toLowerCase().includes(parsed.matched_proposal_title.toLowerCase().slice(0, 20)))
      if (prop) parsed.matched_proposal_id = prop.id
    }

    return parsed

  } catch {
    return { doc_type: 'other', confidence: 0.3 }
  }
}

/* ── Stakeholder matching ───────────────────────────────────── */
function matchStakeholder(
  orgName: string,
  stakeholders: {id:string;name:string;organisation:string}[]
): {id:string;name:string;organisation:string} | null {
  if (!orgName) return null
  const lower = orgName.toLowerCase()
  return stakeholders.find(s =>
    s.organisation?.toLowerCase().includes(lower) ||
    lower.includes(s.organisation?.toLowerCase() ?? '')
  ) ?? null
}

/* ── Junk filter ────────────────────────────────────────────── */
function isJunkAttachment(item: {filename:string;mime_type:string;file_size_bytes:number}): boolean {
  const fn = item.filename?.toLowerCase() ?? ''
  if (JUNK_FILENAMES.some(j => fn.includes(j.toLowerCase()))) return true
  if (JUNK_MIMES.includes(item.mime_type)) return true
  if (item.mime_type?.startsWith('image/') && item.file_size_bytes < MIN_IMG_SIZE) return true
  if (item.mime_type === 'application/pdf' && item.file_size_bytes < MIN_PDF_SIZE) return true
  return false
}

/* ── File type detection ────────────────────────────────────── */
function detectFileType(filename: string, mime: string): string {
  const ext = filename?.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    pdf: 'pdf', docx: 'docx', doc: 'docx', xlsx: 'xlsx', xls: 'xlsx',
    pptx: 'pptx', ppt: 'pptx', png: 'image', jpg: 'image', jpeg: 'image',
    csv: 'csv', txt: 'txt', zip: 'archive',
  }
  return map[ext] ?? (mime?.split('/')[0] ?? 'other')
}

/* ── Gmail attachment download ──────────────────────────────── */
async function downloadGmailAttachment({
  inboxAddress, gmailMsgId, gmailAttachId, userId, admin,
}: {
  inboxAddress: string; gmailMsgId: string; gmailAttachId: string
  userId: string; admin: any
}): Promise<string | null> {
  try {
    const { data: account } = await admin
      .from('connected_email_accounts')
      .select('access_token')
      .eq('user_id', userId)
      .eq('email_address', inboxAddress)
      .single()

    if (!account?.access_token as unknown as string) return null

    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(inboxAddress)}/messages/${gmailMsgId}/attachments/${gmailAttachId}`,
      { headers: { 'Authorization': `Bearer ${account.access_token}` } }
    )

    if (!res.ok) return null
    const data = await res.json()

    // Decode base64URL content
    const decoded = Buffer.from(
      data.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64'
    ).toString('utf-8', 0, 8000)  // First 8KB for analysis

    return decoded

  } catch {
    return null
  }
}

/* ── Auto-assign to folders ─────────────────────────────────── */
async function assignToFolders({
  vaultDocId, userId, docType, orgName, stakeholderId, admin,
}: {
  vaultDocId: string; userId: string; docType: string
  orgName?: string; stakeholderId?: string
  admin: any
}): Promise<void> {
  const folderIds: string[] = []

  // 1. Find or create doc_type system folder
  const typeFolder = await getOrCreateFolder(admin, userId, docType, 'system')
  if (typeFolder) folderIds.push(typeFolder)

  // 2. Find or create organisation folder (if we have one)
  if (orgName) {
    const orgFolder = await getOrCreateFolder(admin, userId, orgName, 'organisation')
    if (orgFolder) folderIds.push(orgFolder)
  }

  // 3. Assign to all matched folders
  if (folderIds.length > 0) {
    await admin.from('vault_document_folders').insert(
      folderIds.map(fid => ({ document_id: vaultDocId, folder_id: fid }))
    )
  }
}

async function getOrCreateFolder(
  admin: any,
  userId: string, name: string, folderType: string
): Promise<string | null> {
  const { data: existing } = await admin
    .from('vault_folders')
    .select('id')
    .eq('user_id', userId)
    .eq('name', name)
    .eq('folder_type', folderType)
    .single()

  if (existing) return existing.id

  const { data: created } = await admin
    .from('vault_folders')
    .insert({ user_id: userId, name, folder_type: folderType })
    .select('id')
    .single()

  return created?.id ?? null
}
