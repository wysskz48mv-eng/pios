/**
 * POST /api/contracts/extract
 * AI-powered contract ingestion — upload PDF/DOCX, extract all fields.
 *
 * Input: Contract document (PDF, DOCX)
 * Output: Structured extraction with confidence scores, clause identification,
 *         obligation extraction, and recommended next actions.
 *
 * Flow:
 *   1. Extract text from document
 *   2. AI extraction of 12+ contract fields
 *   3. Clause identification with confidence scoring
 *   4. Obligation extraction for task creation
 *   5. Auto-file to Contracts space
 *   6. Return pre-filled form data for user review
 *
 * PIOS v3.7.2 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { apiError } from '@/lib/api-error'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const allowed = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Only PDF, Word, and text files accepted' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // ── Extract text ────────────────────────────────────────────────────────
    let fullText = ''
    if (file.type === 'application/pdf') {
      fullText = await extractPdfText(buffer)
    } else if (file.type.includes('word')) {
      fullText = await extractDocxText(buffer)
    } else {
      fullText = buffer.toString('utf-8')
    }

    if (fullText.length < 50) {
      return NextResponse.json({ error: 'Could not extract sufficient text from document' }, { status: 400 })
    }

    // ── Upload to storage ───────────────────────────────────────────────────
    const ext = file.name.split('.').pop() ?? 'pdf'
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_').toLowerCase()
    const path = `${user.id}/${Date.now()}_${safeName}`

    await (supabase as any).storage.from('pios-files').upload(path, buffer, {
      contentType: file.type, upsert: false,
    })

    const { data: urlData } = await (supabase as any)
      .storage.from('pios-files').createSignedUrl(path, 60 * 60 * 24 * 7)
    const fileUrl = urlData?.signedUrl ?? null

    // ── AI Contract Extraction ──────────────────────────────────────────────
    const extraction = await extractContractFields(file.name, fullText)

    // ── File to Contracts space ─────────────────────────────────────────────
    const { data: contractSpace } = await supabase
      .from('file_spaces')
      .select('id')
      .eq('user_id', user.id)
      .eq('path', 'Contracts')
      .maybeSingle()

    // Store in file_items
    await (supabase as any).from('file_items').insert({
      user_id: user.id,
      name: file.name,
      file_type: ext,
      mime_type: file.type,
      size_bytes: file.size,
      source: 'upload',
      drive_web_url: fileUrl,
      space_id: contractSpace?.id ?? null,
      ai_category: 'contract',
      ai_summary: extraction?.key_terms?.slice(0, 500) ?? null,
      ai_confidence: extraction?.confidence_scores?.title ?? null,
      filing_status: contractSpace?.id ? 'filed' : 'classified',
    })

    return NextResponse.json({
      extraction,
      file_url: fileUrl,
      filed_to: contractSpace?.id ? 'Contracts' : null,
      text_length: fullText.length,
      pages: Math.ceil(fullText.length / 3000),
    })
  } catch (err) {
    console.error('[PIOS contracts/extract]', err)
    return apiError(err)
  }
}

// ── AI Extraction ───────────────────────────────────────────────────────────

async function extractContractFields(filename: string, text: string) {
  const system = `You are a contract intelligence extraction engine. Extract ALL fields from the contract text.

Return ONLY valid JSON:
{
  "title": "<contract title or descriptive name>",
  "contract_type": "<client|supplier|employment|nda|licence|partnership|lease|service|consultancy|other>",
  "counterparty": "<other party name>",
  "value": <number or null>,
  "currency": "<GBP|USD|EUR|AED|SAR or null>",
  "start_date": "<YYYY-MM-DD or null>",
  "end_date": "<YYYY-MM-DD or null>",
  "notice_period_days": <number or null>,
  "auto_renewal": <true|false>,
  "renewal_terms": "<renewal clause summary or null>",
  "key_terms": "<2-3 sentence summary of key commercial terms>",
  "obligations": "<key obligations as bullet points>",
  "governing_law": "<jurisdiction>",
  "status": "<active|draft|expired|terminated>",
  "domain": "<business|academic|personal>",
  "extracted_clauses": [
    {
      "clause_type": "<termination|renewal|liability|payment|confidentiality|indemnity|warranty|ip|data_protection|force_majeure|dispute|other>",
      "content": "<clause text, max 200 chars>",
      "confidence": 0.95
    }
  ],
  "key_parties": ["<name1>", "<name2>"],
  "key_dates": [
    {"label": "<description>", "date": "YYYY-MM-DD"}
  ],
  "flags": ["<unsigned|missing_termination|no_liability_cap|auto_renews|high_value|expiring_soon|no_governing_law>"],
  "confidence_scores": {
    "title": 0.95,
    "counterparty": 0.98,
    "dates": 0.92,
    "value": 0.87,
    "terms": 0.85
  },
  "next_actions": ["<create_renewal_reminder|legal_review_needed|add_to_stakeholders|create_payment_schedule|flag_for_audit>"]
}

Rules:
- Extract ONLY values explicitly found in text — never hallucinate
- Set null for fields not found in the document
- Confidence < 0.7 means the field was inferred, not explicitly stated
- Always identify at least 3 clauses if the document is a real contract
- Flags should highlight risks or missing items
- next_actions should be actionable PIOS tasks`

  try {
    const raw = await callClaude(
      [{ role: 'user', content: `Filename: ${filename}\n\nContract text:\n${text.slice(0, 8000)}` }],
      system, 2000
    )
    return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```/g, '').trim())
  } catch {
    return null
  }
}

// ── Text extraction helpers ─────────────────────────────────────────────────

async function extractPdfText(buffer: Buffer): Promise<string> {
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
        messages: [{ role: 'user', content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') } },
          { type: 'text', text: 'Extract all text from this contract document. Return only the raw text.' },
        ]}],
      }),
    })
    if (res.ok) {
      const data = await res.json()
      return data.content?.[0]?.text ?? ''
    }
  } catch {}

  try {
    const pdfParse = await import('pdf-parse')
    const parseFn = (pdfParse as any).default ?? pdfParse
    const result = await parseFn(buffer)
    return result.text?.slice(0, 10000) ?? ''
  } catch {}

  return ''
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const text = buffer.toString('utf-8')
    const matches = text.match(/<w:t(?:[^>]*)?>([^<]*)<\/w:t>/g)
    if (matches?.length) return matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ').slice(0, 10000)
  } catch {}

  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value?.slice(0, 10000) ?? ''
  } catch {}

  return ''
}
