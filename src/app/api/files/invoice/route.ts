import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

export const runtime = 'nodejs'
export const maxDuration = 45

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/files/invoice
// Extracts structured invoice data from file_items or email_items.
// Saves to invoices table. All financial amounts require HITL approval.
//
// body: { source: 'file'|'email', source_id, text? }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { source, source_id, text, invoice_type } = await request.json()
    if (!source_id) return NextResponse.json({ error: 'source_id required' }, { status: 400 })

    // Fetch source item
    let sourceText = text ?? ''
    let fileName = ''
    let emailId: string | null = null
    let fileId: string | null = null

    if (source === 'email') {
      const { data: email } = await supabase.from('email_items')
        .select('subject, sender_name, sender_email, snippet, body_text').eq('id', source_id).single()
      if (email) {
        sourceText = `Subject: ${email.subject}\nFrom: ${email.sender_name} <${email.sender_email}>\n\n${email.body_text ?? email.snippet ?? ''}`
        fileName = email.subject ?? 'Email'
      }
      emailId = source_id
    } else {
      const { data: file } = await supabase.from('file_items')
        .select('name, ai_summary').eq('id', source_id).single()
      if (file) {
        sourceText = sourceText || file.ai_summary || file.name
        fileName = file.name
      }
      fileId = source_id
    }

    const today = new Date().toISOString().slice(0, 10)
    const system = `You are an invoice data extraction AI. Extract all invoice fields from the provided text. Today is ${today}.

Douglas Masuku's companies: VeritasIQ Technologies Ltd (UAE), Sustain International UK Ltd (UK), VeritasIQ Technologies Ltd (UK).
His projects: Qiddiya (QPMO-410), King Salman Park (KSP), VeritasEdge™, InvestiScript, PIOS.

Return ONLY valid JSON:
{
  "invoice_number": "string or null",
  "invoice_type": "receivable|payable|payroll|expense|credit_note",
  "supplier_name": "string or null",
  "supplier_email": "string or null",
  "client_name": "string or null",
  "currency": "GBP|USD|SAR|AED|EUR",
  "subtotal": number or null,
  "tax_amount": number or null,
  "total_amount": number,
  "invoice_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "project_match": "project name if detectable or null",
  "company_entity": "which Sustain entity this relates to or null",
  "expense_category": "category if determinable or null",
  "vat_applicable": boolean,
  "tax_year": "YYYY-YY format or null",
  "confidence": 0.0-1.0,
  "extraction_notes": "any caveats about the extraction"
}`

    const raw = await callClaude(
      [{ role: 'user', content: `Extract invoice data from:\n\nFILE: ${fileName}\n\n${sourceText}` }],
      system, 1200
    )

    let extracted: unknown = {}
    try {
      extracted = JSON.parse(raw.replace(/```json|```/g, '').trim())
    } catch {
      return NextResponse.json({ error: 'Extraction failed — could not parse AI response' }, { status: 500 })
    }

    if (!extracted.total_amount) {
      return NextResponse.json({ error: 'No invoice amount detected. This may not be an invoice.', raw: extracted }, { status: 422 })
    }

    // Find project ID if matched
    let projectId: string | null = null
    if (extracted.project_match) {
      const { data: proj } = await supabase.from('projects')
        .select('id').eq('user_id', user.id).ilike('title', `%${extracted.project_match}%`).limit(1).single()
      if (proj) projectId = proj.id
    }

    // Save invoice
  try {
      const { data: invoice } = await supabase.from('invoices').insert({
        user_id: user.id,
        file_item_id: fileId,
        email_item_id: emailId,
        invoice_number: extracted.invoice_number,
        invoice_type: invoice_type ?? extracted.invoice_type ?? 'payable',
        supplier_name: extracted.supplier_name,
        supplier_email: extracted.supplier_email,
        client_name: extracted.client_name,
        currency: extracted.currency ?? 'GBP',
        subtotal: extracted.subtotal,
        tax_amount: extracted.tax_amount,
        total_amount: extracted.total_amount,
        amount_due: extracted.total_amount,
        invoice_date: extracted.invoice_date,
        due_date: extracted.due_date,
        project_id: projectId,
        company_entity: extracted.company_entity,
        expense_category: extracted.expense_category,
        vat_applicable: extracted.vat_applicable ?? false,
        tax_year: extracted.tax_year,
        status: 'pending',
        ai_extracted: true,
        ai_confidence: extracted.confidence,
        raw_text: sourceText.slice(0, 2000),
      }).select('id').single()

      // Update file item category if this is a file
      if (fileId) {
        await supabase.from('file_items').update({ ai_category: 'invoice', updated_at: new Date().toISOString() }).eq('id', fileId)
      }

      return NextResponse.json({
        invoice_id: invoice?.id,
        extracted,
        hitl_required: true,
        hitl_message: 'Invoice extracted — requires your approval before processing payment or filing for tax purposes.',
      })
    } catch (err: unknown) {
      console.error('/api/files/invoice:', err)
      return NextResponse.json({ error: err.message ?? 'Extraction failed' }, { status: 500 })
    }

  } catch (err: unknown) {
    console.error('[PIOS] files/invoice POST:', err.message)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }}

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase.from('invoices')
      .select('*').eq('user_id', user.id)
      .order('invoice_date', { ascending: false }).limit(50)
    return NextResponse.json({ invoices: data ?? [] })
  } catch (err: unknown) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
