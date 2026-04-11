/**
 * POST /api/intelligence/upload-document
 * Upload project document → AI extracts intelligence → auto-populate PIOS
 * Creates: project, tasks, risks, compliance, stakeholders
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
    const docType = String(formData.get('documentType') ?? 'charter')
    const autoPopulate = formData.get('autoPopulate') !== 'false'

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Extract text
    let text = ''
    if (file.type === 'application/pdf') {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01', 'anthropic-beta': 'pdfs-2024-09-25', 'content-type': 'application/json' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4000,
            messages: [{ role: 'user', content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') } }, { type: 'text', text: 'Extract all text from this document.' }] }] }),
        })
        if (res.ok) { const d = await res.json(); text = d.content?.[0]?.text ?? '' }
      } catch {}
      if (!text) {
        try { const p = await import('pdf-parse'); const fn = (p as any).default ?? p; text = (await fn(buffer)).text?.slice(0, 10000) ?? '' } catch {}
      }
    } else {
      text = buffer.toString('utf-8').slice(0, 10000)
    }

    if (text.length < 50) return NextResponse.json({ error: 'Could not extract text from document' }, { status: 400 })

    // Store document
    const { data: doc } = await (supabase as any).from('project_source_documents').insert({
      user_id: user.id, filename: file.name, file_type: docType,
      source_content: text.slice(0, 50000), file_size_bytes: file.size, pages_count: Math.ceil(text.length / 3000),
    }).select().single()

    // AI extraction
    const system = `Extract project intelligence from this ${docType} document. Return ONLY valid JSON:
{
  "project_title": "string",
  "description": "string (2-3 sentences)",
  "budget_total": number or null,
  "budget_currency": "SAR|GBP|USD|EUR",
  "start_date": "YYYY-MM-DD or null",
  "end_date": "YYYY-MM-DD or null",
  "scope": ["scope item 1", "scope item 2"],
  "deliverables": [{"name": "string", "description": "string"}],
  "milestones": [{"name": "string", "date": "YYYY-MM-DD or null"}],
  "success_criteria": ["criterion 1"],
  "risks": [{"description": "string", "probability": "low|medium|high", "impact": "low|medium|high"}],
  "compliance_frameworks": ["framework name"],
  "stakeholders": [{"name": "string", "role": "string"}],
  "dependencies": ["dependency"],
  "immediate_actions": ["action"]
}`

    const raw = await callClaude([{ role: 'user', content: `Document type: ${docType}\n\n${text.slice(0, 6000)}` }], system, 2000)
    let intel: any = {}
    try { intel = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```/g, '').trim()) } catch {}

    // Confidence score
    const fields = ['project_title', 'description', 'budget_total', 'start_date', 'end_date', 'scope', 'deliverables', 'risks', 'compliance_frameworks', 'stakeholders']
    const filled = fields.filter(f => intel[f] && (Array.isArray(intel[f]) ? intel[f].length > 0 : true)).length
    const confidence = Math.round((filled / fields.length) * 100) / 100

    // Store extraction
    await (supabase as any).from('document_extracts').insert({
      document_id: doc?.id, extraction_raw: intel, confidence_score: confidence, validation_status: 'pending',
    })

    let projectId = null
    const results = { tasks: 0, risks: 0, compliance: 0, stakeholders: 0 }

    if (autoPopulate && intel.project_title) {
      // Create project
      const { data: proj } = await (supabase as any).from('projects').insert({
        user_id: user.id, title: intel.project_title, description: intel.description?.slice(0, 500),
        domain: 'business', status: 'active',
      }).select().single()
      projectId = proj?.id

      // Create tasks from deliverables + milestones
      for (const d of intel.deliverables ?? []) {
        await (supabase as any).from('tasks').insert({
          user_id: user.id, title: d.name, description: d.description, domain: 'business', status: 'active', priority: 'medium',
        })
        results.tasks++
      }
      for (const m of intel.milestones ?? []) {
        await (supabase as any).from('tasks').insert({
          user_id: user.id, title: `Milestone: ${m.name}`, due_date: m.date, domain: 'business', status: 'active', priority: 'high',
        })
        results.tasks++
      }

      // Create risks
      for (const r of intel.risks ?? []) {
        const score = (r.probability === 'high' && r.impact === 'high') ? 9 : (r.probability === 'high' || r.impact === 'high') ? 6 : 3
        await (supabase as any).from('project_risks').insert({
          user_id: user.id, project_id: projectId, document_id: doc?.id,
          risk_description: r.description, probability: r.probability, impact: r.impact, priority_score: score,
        })
        results.risks++
      }

      // Create compliance
      for (const fw of intel.compliance_frameworks ?? []) {
        await (supabase as any).from('project_compliance').insert({
          user_id: user.id, project_id: projectId, document_id: doc?.id,
          requirement: `Compliance with ${fw}`, compliance_framework: fw,
        })
        results.compliance++
      }

      // Create stakeholders
      for (const s of intel.stakeholders ?? []) {
        await (supabase as any).from('exec_stakeholders').insert({
          user_id: user.id, name: s.name, role: s.role, relationship_type: 'professional', importance: 'high',
        }).catch(() => {})
        results.stakeholders++
      }

      // Store intelligence record
      await (supabase as any).from('project_intelligence').insert({
        user_id: user.id, project_id: projectId, document_id: doc?.id,
        project_title: intel.project_title, description: intel.description,
        budget_total: intel.budget_total, scope: intel.scope, deliverables: intel.deliverables,
        success_criteria: intel.success_criteria, risks: intel.risks,
        compliance_frameworks: intel.compliance_frameworks, extraction_confidence: confidence,
      })
    }

    return NextResponse.json({
      ok: true, document_id: doc?.id, project_id: projectId,
      intelligence: intel, confidence, auto_populated: autoPopulate, results,
    })
  } catch (err) {
    console.error('[PIOS intelligence/upload]', err)
    return apiError(err)
  }
}
