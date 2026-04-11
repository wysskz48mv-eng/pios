/**
 * POST /api/files/upload — Upload + AI Document Intelligence
 *
 * Input: Any document (PDF, email, image, form, Word, Excel)
 * Output: Structured JSON with type, confidence, extracted data,
 *         urgency score, flags, and recommended next actions.
 *
 * Flow:
 *   1. Validate file type + size + magic bytes
 *   2. Upload to Supabase Storage
 *   3. Extract text (Claude PDF, mammoth DOCX, raw text)
 *   4. AI classification + data extraction via Claude
 *   5. Auto-file to correct space based on filing rules
 *   6. Return structured intelligence JSON
 *
 * PIOS v3.7.2 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'

export const runtime = 'nodejs'
export const maxDuration = 60

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/json',
]

const MAX_SIZE_MB = 25

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const domain = String(formData.get('domain') ?? 'business')
    const tags = String(formData.get('tags') ?? '').split(',').map(t => t.trim()).filter(Boolean)

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({
        error: `File type not allowed: ${file.type}. Allowed: PDF, Word, Excel, images, CSV, JSON.`
      }, { status: 400 })
    }

    const sizeMb = file.size / (1024 * 1024)
    if (sizeMb > MAX_SIZE_MB) {
      return NextResponse.json({ error: `File too large (${sizeMb.toFixed(1)} MB). Max: ${MAX_SIZE_MB} MB.` }, { status: 400 })
    }

    const ext = file.name.split('.').pop() ?? 'bin'
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_').toLowerCase()
    const path = `${user.id}/${Date.now()}_${safeName}`

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Validate magic bytes
    const magicMismatch = checkMagicBytes(buffer, file.type)
    if (magicMismatch) {
      return NextResponse.json({ error: magicMismatch }, { status: 400 })
    }

    // ── Upload to storage ───────────────────────────────────────────────────
    const { error: uploadErr } = await (supabase as any)
      .storage.from('pios-files').upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      })
    if (uploadErr) throw uploadErr

    const { data: urlData } = await (supabase as any)
      .storage.from('pios-files').createSignedUrl(path, 60 * 60 * 24 * 7)
    const fileUrl = urlData?.signedUrl ?? null

    // ── Extract text content ────────────────────────────────────────────────
    let extractedText = ''
    if (file.type === 'application/pdf') {
      extractedText = await extractPdfText(buffer)
    } else if (file.type.includes('wordprocessingml') || file.type === 'application/msword') {
      extractedText = await extractDocxText(buffer)
    } else if (file.type.startsWith('text/') || file.type === 'application/json') {
      extractedText = buffer.toString('utf-8').slice(0, 8000)
    } else if (file.type.startsWith('image/')) {
      extractedText = `[Image file: ${file.name}]`
    }

    // ── AI Document Intelligence ────────────────────────────────────────────
    let intelligence: DocumentIntelligence | null = null
    if (extractedText && extractedText.length > 10) {
      intelligence = await analyzeDocument(file.name, file.type, extractedText)
    }

    // ── Auto-file based on intelligence + filing rules ──────────────────────
    let spaceId: string | null = null
    if (intelligence?.type) {
      const { data: rules } = await supabase
        .from('filing_rules')
        .select('*, file_spaces!filing_rules_action_value_fkey(id)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('priority')

      const { data: spaces } = await supabase
        .from('file_spaces')
        .select('id, name, path')
        .eq('user_id', user.id)

      // Match by AI category
      for (const rule of rules ?? []) {
        if (rule.trigger_type === 'ai_category' && rule.action_type === 'file_to_space') {
          if (rule.trigger_value?.toLowerCase() === intelligence.type) {
            const match = (spaces ?? []).find((s: any) => s.path === rule.action_value || s.name === rule.action_value)
            if (match) { spaceId = match.id; break }
          }
        }
      }
    }

    // ── Save to database ────────────────────────────────────────────────────
    const { data: fileRecord, error: dbErr } = await (supabase as any)
      .from('file_items').insert({
        user_id: user.id,
        name: file.name,
        file_type: ext,
        mime_type: file.type,
        size_bytes: file.size,
        source: 'upload',
        drive_web_url: fileUrl,
        tags,
        space_id: spaceId,
        ai_category: intelligence?.type ?? null,
        ai_summary: intelligence?.summary ?? null,
        ai_confidence: intelligence?.confidence ?? null,
        filing_status: spaceId ? 'filed' : intelligence ? 'classified' : 'unprocessed',
        created_at: new Date().toISOString(),
      }).select().single()

    if (dbErr) {
      await (supabase as any).storage.from('pios-files').remove([path])
      throw dbErr
    }

    // ── Feed intelligence to 6 PIOS modules ────────────────────────────────
    const moduleActions = intelligence
      ? await feedToModules(supabase, user.id, fileRecord, intelligence)
      : { tasks: 0, expenses: 0, stakeholders: 0, notifications: 0 }

    return NextResponse.json({
      file: fileRecord,
      url: fileUrl,
      intelligence,
      filed_to: spaceId ? { space_id: spaceId } : null,
      module_actions: moduleActions,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[PIOS files/upload]', msg)
    return NextResponse.json({ error: `Upload failed: ${msg.slice(0, 200)}` }, { status: 500 })
  }
}

// ── Document Intelligence Types ─────────────────────────────────────────────

interface DocumentIntelligence {
  type: string
  confidence: number
  summary: string
  vendor?: string
  amount?: number
  currency?: string
  dueDate?: string
  urgency: number
  lineItems?: { description: string; quantity?: number; amount?: number }[]
  keyParties?: string[]
  keyDates?: { label: string; date: string }[]
  flags: string[]
  nextActions: string[]
}

// ── Module Integration Layer ────────────────────────────────────────────────
// Feeds extracted intelligence into 6 PIOS modules automatically

async function feedToModules(supabase: any, userId: string, file: any, intel: DocumentIntelligence) {
  const results = { tasks: 0, expenses: 0, stakeholders: 0, notifications: 0 }

  // ── 1. TASK MODULE — auto-create tasks from nextActions ─────────────────
  for (const action of intel.nextActions ?? []) {
    const taskTitle = actionToTaskTitle(action, intel, file.name)
    if (taskTitle) {
      const dueDate = intel.dueDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      await supabase.from('tasks').insert({
        user_id: userId,
        title: taskTitle,
        description: `Auto-created from document: ${file.name}\n\nType: ${intel.type}\nConfidence: ${(intel.confidence * 100).toFixed(0)}%\n${intel.summary}\n\nFlags: ${intel.flags?.join(', ') || 'none'}`,
        domain: intel.type === 'academic' ? 'academic' : 'business',
        status: 'active',
        priority: intel.urgency >= 8 ? 'high' : intel.urgency >= 5 ? 'medium' : 'low',
        due_date: dueDate,
      }).then(() => { results.tasks++ })
    }
  }

  // ── 2. FINANCE MODULE — create expense from invoices/receipts ───────────
  if ((intel.type === 'invoice' || intel.type === 'receipt') && intel.amount && intel.amount > 0) {
    const desc = `${intel.vendor ?? 'Unknown'} — ${intel.type} from ${file.name}`
    const { data: exists } = await supabase.from('expenses')
      .select('id').eq('user_id', userId).eq('description', desc).maybeSingle()

    if (!exists) {
      await supabase.from('expenses').insert({
        user_id: userId,
        description: desc,
        amount: intel.amount,
        currency: intel.currency ?? 'GBP',
        category: intel.type === 'receipt' ? 'other' : 'invoice',
        domain: 'business',
        date: intel.dueDate ?? new Date().toISOString().slice(0, 10),
        notes: `Auto-extracted. ${intel.lineItems?.length ?? 0} line items. Flags: ${intel.flags?.join(', ') || 'none'}`,
      })
      results.expenses++
    }
  }

  // ── 3. CRM/STAKEHOLDERS — update from contracts/correspondence ─────────
  if (intel.keyParties?.length && (intel.type === 'contract' || intel.type === 'correspondence' || intel.type === 'proposal')) {
    for (const party of intel.keyParties.slice(0, 3)) {
      const { data: exists } = await supabase.from('exec_stakeholders')
        .select('id').eq('user_id', userId).ilike('name', `%${party}%`).maybeSingle()

      if (!exists && party.length > 2) {
        await supabase.from('exec_stakeholders').insert({
          user_id: userId,
          name: party,
          organisation: intel.vendor ?? null,
          relationship_type: intel.type === 'contract' ? 'client' : 'professional',
          importance: intel.urgency >= 7 ? 'high' : 'medium',
          notes: `Auto-created from ${intel.type}: ${file.name}`,
          last_interaction: new Date().toISOString(),
        })
        results.stakeholders++
      }
    }
  }

  // ── 4. NOTIFICATIONS — alert on urgent/flagged documents ───────────────
  if (intel.urgency >= 7 || (intel.flags?.length ?? 0) > 0) {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'document',
      title: `${intel.type === 'invoice' ? '🧾' : intel.type === 'contract' ? '📝' : '📄'} ${intel.type.charAt(0).toUpperCase() + intel.type.slice(1)} requires attention`,
      message: `${intel.summary}${intel.flags?.length ? `\n\nFlags: ${intel.flags.join(', ')}` : ''}`,
      link: '/platform/documents',
      is_read: false,
    })
    results.notifications++
  }

  // ── 5. CALENDAR — add key dates from contracts ─────────────────────────
  if (intel.keyDates?.length) {
    for (const kd of intel.keyDates.slice(0, 3)) {
      await supabase.from('calendar_events').insert({
        user_id: userId,
        title: `${kd.label} — ${file.name}`,
        event_date: kd.date,
        event_type: 'deadline',
        domain: 'business',
        notes: `Auto-created from ${intel.type}. ${intel.summary}`,
      }).catch(() => {}) // calendar_events may not exist
    }
  }

  return results
}

function actionToTaskTitle(action: string, intel: DocumentIntelligence, filename: string): string | null {
  const map: Record<string, string> = {
    'create_approval_task': `Approve ${intel.type}: ${intel.vendor ?? filename}${intel.amount ? ` — ${intel.currency ?? ''}${intel.amount}` : ''}`,
    'validate_against_po': `Validate PO match: ${intel.vendor ?? filename}`,
    'update_vendor_record': `Update vendor: ${intel.vendor ?? 'Unknown'}`,
    'file_to_finance': `File to finance: ${filename}`,
    'create_contract_entry': `Review contract: ${intel.vendor ?? filename}`,
    'schedule_review': `Schedule review: ${filename}`,
    'create_expense': `Process expense: ${intel.vendor ?? filename}${intel.amount ? ` — ${intel.currency ?? ''}${intel.amount}` : ''}`,
    'flag_for_audit': `Audit flag: ${filename} — ${intel.flags?.join(', ') ?? 'review needed'}`,
    'send_payment': `Process payment: ${intel.vendor ?? filename}${intel.amount ? ` — ${intel.currency ?? ''}${intel.amount}` : ''}`,
    'sign_document': `Sign: ${filename}`,
    'review_terms': `Review terms: ${filename}`,
  }
  return map[action] ?? (action.startsWith('create_') || action.startsWith('review_') || action.startsWith('schedule_')
    ? `${action.replace(/_/g, ' ')}: ${filename}`
    : null)
}

// ── AI Analysis ─────────────────────────────────────────────────────────────

async function analyzeDocument(filename: string, mimeType: string, text: string): Promise<DocumentIntelligence | null> {
  const system = `You are the PIOS Document Intelligence engine. Analyze uploaded documents and return structured JSON.

Document types: invoice, contract, report, proposal, correspondence, technical, financial, legal, personal, academic, presentation, receipt, form, policy, certificate, other.

Return ONLY valid JSON:
{
  "type": "<document_type>",
  "confidence": 0.0-1.0,
  "summary": "<1-2 sentence description>",
  "vendor": "<company/sender if applicable>",
  "amount": <number if financial>,
  "currency": "<GBP/USD/EUR if financial>",
  "dueDate": "<YYYY-MM-DD if applicable>",
  "urgency": 1-10,
  "lineItems": [{"description": string, "quantity": number, "amount": number}],
  "keyParties": ["<names of people/companies involved>"],
  "keyDates": [{"label": string, "date": "YYYY-MM-DD"}],
  "flags": ["<any concerns: no_po_match, duplicate_suspect, high_value, unsigned, expired, missing_signature, overdue, etc>"],
  "nextActions": ["<recommended PIOS actions: create_approval_task, validate_against_po, update_vendor_record, file_to_finance, create_contract_entry, schedule_review, create_expense, flag_for_audit, etc>"]
}

Rules:
- urgency 8-10: needs action today (overdue invoices, expiring contracts)
- urgency 5-7: needs action this week
- urgency 1-4: informational, can be filed
- Always suggest at least one nextAction
- For invoices: extract vendor, amount, line items, due date
- For contracts: extract parties, dates, key terms
- For receipts: extract vendor, amount, date
- Be specific in flags (e.g. "amount_over_5000" not just "high_value")`

  try {
    const raw = await callClaude(
      [{ role: 'user', content: `Filename: ${filename}\nType: ${mimeType}\n\nContent:\n${text.slice(0, 6000)}` }],
      system,
      1500,
    )
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

// ── Text extraction ─────────────────────────────────────────────────────────

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Use Claude's PDF document support
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [{
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
          }, {
            type: 'text',
            text: 'Extract all text content from this document. Return only the raw text, no commentary.',
          }],
        }],
      }),
    })
    if (res.ok) {
      const data = await res.json()
      return data.content?.[0]?.text ?? ''
    }
  } catch {}

  // Fallback: try pdf-parse
  try {
    const pdfParse = await import('pdf-parse')
    const parseFn = (pdfParse as any).default ?? pdfParse
    const result = await parseFn(buffer)
    return result.text?.slice(0, 8000) ?? ''
  } catch {}

  return ''
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  // Try XML extraction first
  try {
    const text = buffer.toString('utf-8')
    const matches = text.match(/<w:t(?:[^>]*)?>([^<]*)<\/w:t>/g)
    if (matches?.length) {
      return matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ').slice(0, 8000)
    }
  } catch {}

  // Fallback: mammoth
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value?.slice(0, 8000) ?? ''
  } catch {}

  return ''
}

// ── Magic byte validation ───────────────────────────────────────────────────

function checkMagicBytes(buffer: Buffer, declaredType: string): string | null {
  if (buffer.length < 4) return 'File too small to validate'

  const SIGNATURES: Record<string, number[][]> = {
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
    'image/png': [[0x89, 0x50, 0x4E, 0x47]],
    'image/jpeg': [[0xFF, 0xD8, 0xFF]],
    'image/gif': [[0x47, 0x49, 0x46, 0x38]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46]],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4B, 0x03, 0x04]],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [[0x50, 0x4B, 0x03, 0x04]],
    'application/msword': [[0xD0, 0xCF, 0x11, 0xE0]],
    'application/vnd.ms-excel': [[0xD0, 0xCF, 0x11, 0xE0]],
  }

  const expected = SIGNATURES[declaredType]
  if (!expected) return null

  const matches = expected.some(sig => sig.every((byte, i) => buffer[i] === byte))
  if (!matches) return 'File content does not match declared type. Upload rejected.'
  return null
}
