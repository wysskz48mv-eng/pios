/**
 * POST /api/cv
 * CV Upload + NemoClaw™ Intelligence Calibration
 *
 * Accepts a PDF or DOCX file (multipart/form-data).
 * Pipeline:
 *   1. Upload raw file to Supabase Storage (pios-cv bucket)
 *   2. Extract text from PDF/DOCX
 *   3. Call Claude to extract structured profile data
 *   4. Call Claude again to produce NemoClaw™ calibration profile
 *   5. Persist to nemoclaw_calibration + update user_profiles
 *   6. Return extracted fields for profile auto-fill + calibration summary
 *
 * GET /api/cv — return existing calibration for current user
 *
 * PIOS v3.0 · VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

// ── Claude helper ─────────────────────────────────────────────────────────────
async function callClaude(prompt: string, system: string, maxTokens = 1500): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  return data?.content?.[0]?.text ?? ''
}

// ── GET — return existing calibration ─────────────────────────────────────────
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: cal } = await supabase
      .from('nemoclaw_calibration')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('cv_filename, cv_uploaded_at, cv_processing_status')
      .eq('id', user.id)
      .single()

    return NextResponse.json({ calibration: cal, cv: profile })
  } catch {
    return NextResponse.json({ calibration: null, cv: null })
  }
}

// ── POST — upload + extract + calibrate ───────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('cv') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const fname = file.name.toLowerCase()
    console.log('[CV] file:', fname, 'type:', file.type, 'size:', file.size)

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be under 5MB.' }, { status: 400 })
    }

    const isPdf  = fname.endsWith('.pdf')  || file.type === 'application/pdf'
    const isDocx = fname.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    const isDoc  = fname.endsWith('.doc')  || file.type === 'application/msword'
    const isTxt  = fname.endsWith('.txt')  || file.type === 'text/plain'

    if (!isPdf && !isDocx && !isDoc && !isTxt) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type || fname}. Please upload PDF, DOCX, DOC, or TXT.` }, { status: 400 })
    }

    // Mark processing
    const svc = createServiceClient()
    await svc.from('user_profiles').update({
      cv_filename: file.name,
      cv_processing_status: 'processing',
      cv_uploaded_at: new Date().toISOString(),
    }).eq('id', user.id)

    const bytes = await file.arrayBuffer()
    const buf   = Buffer.from(bytes)

    // ── Extract text ──────────────────────────────────────────────────────────
    let cvText = ''
    const errors: string[] = []

    if (isTxt) {
      cvText = await file.text()
      console.log('[CV] TXT extraction:', cvText.length, 'chars')

    } else if (isPdf) {
      // Try pdf-parse
      try {
        let pdfParseFn: ((buf: Buffer) => Promise<{text: string}>) | null = null
        try { pdfParseFn = require('pdf-parse') } catch { /* */ }
        if (typeof pdfParseFn !== 'function') {
          try { const m = require('pdf-parse'); pdfParseFn = m.default ?? m } catch { /* */ }
        }
        if (typeof pdfParseFn === 'function') {
          const r = await pdfParseFn(buf)
          cvText = r.text ?? ''
          console.log('[CV] pdf-parse result:', cvText.length, 'chars')
        } else {
          errors.push('pdf-parse not available')
        }
      } catch (e: any) {
        errors.push('pdf-parse: ' + e.message)
        console.error('[CV] pdf-parse error:', e.message)
      }

      // Fallback: send PDF to Claude as base64 document
      if (!cvText || cvText.trim().length < 50) {
        try {
          const base64 = buf.toString('base64')
          const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
              'anthropic-version': '2023-06-01',
              'anthropic-beta': 'pdfs-2024-09-25',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 4000,
              messages: [{ role: 'user', content: [
                { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
                { type: 'text', text: 'Extract all text from this CV. Output raw text only, no commentary.' },
              ]}],
            }),
          })
          const d = await r.json()
          const t = d?.content?.[0]?.text ?? ''
          if (t.length > 50) { cvText = t; console.log('[CV] Claude PDF extraction:', t.length, 'chars') }
          else errors.push('Claude PDF: ' + (d?.error?.message ?? 'empty'))
        } catch (e: any) {
          errors.push('Claude PDF: ' + e.message)
        }
      }

    } else if (isDocx || isDoc) {
      // Try mammoth
      try {
        const mammothMod = require('mammoth')
        const fn = typeof mammothMod === 'object' ? (mammothMod.extractRawText ?? mammothMod.default?.extractRawText) : null
        if (typeof fn === 'function') {
          const r = await fn({ buffer: buf })
          cvText = r.value ?? ''
          console.log('[CV] mammoth result:', cvText.length, 'chars', 'msgs:', r.messages?.length)
        } else {
          errors.push('mammoth.extractRawText not found')
        }
      } catch (e: any) {
        errors.push('mammoth: ' + e.message)
        console.error('[CV] mammoth error:', e.message)
      }

      // Fallback: raw XML text from DOCX zip structure
      if (!cvText || cvText.trim().length < 50) {
        try {
          const str = buf.toString('latin1') // latin1 preserves bytes
          const matches = str.match(/<w:t(?:\s[^>]*)?>([^<]+)<\/w:t>/g) ?? []
          if (matches.length > 3) {
            cvText = matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ').replace(/\s+/g, ' ').trim()
            console.log('[CV] XML fallback:', cvText.length, 'chars from', matches.length, 'runs')
          } else {
            errors.push('XML fallback: only ' + matches.length + ' text runs found')
          }
        } catch (e: any) {
          errors.push('XML: ' + e.message)
        }
      }
    }

    console.log('[CV] final cvText length:', cvText.trim().length, 'errors:', errors)

    if (!cvText || cvText.trim().length < 50) {
      await svc.from('user_profiles').update({ cv_processing_status: 'failed' }).eq('id', user.id)
      return NextResponse.json({
        error: `Could not extract text from your CV. Errors: ${errors.join('; ') || 'unknown'}. Try saving as PDF or plain text (.txt).`,
      }, { status: 422 })
    }

    // ── Agent 1: Structured extraction ────────────────────────────────────────
    const extractionPrompt = `Analyse this CV and return ONLY a JSON object with these exact fields. No markdown, no commentary, pure JSON:

{
  "full_name": "",
  "job_title": "",
  "organisation": "",
  "email": "",
  "education_level": "doctoral|masters|bachelors|professional|other",
  "education_detail": "",
  "qualifications": [],
  "career_years": 0,
  "seniority_level": "c_suite|senior|mid|junior|student",
  "primary_industry": "",
  "industries": [],
  "employers": [],
  "skills": [],
  "key_achievements": []
}

CV TEXT:
${cvText.slice(0, 8000)}`

    const extractionRaw = await callClaude(extractionPrompt,
      'You are a precise CV parser. Return only valid JSON, no markdown fences, no explanation.', 2000)

    let extracted: Record<string, unknown> = {}
    try {
      const cleaned = extractionRaw.replace(/```json|```/g, '').trim()
      extracted = JSON.parse(cleaned)
    } catch {
      // Partial parse — continue with empty
    }

    // ── Agent 2: NemoClaw™ Calibration ────────────────────────────────────────
    const NEMOCLAW_FRAMEWORKS = [
      'SDL (Strategic Direction Layer)',
      'POM (Portfolio Orchestration Model)',
      'OAE (Organisational Agility Engine)',
      'CVDM (Client Value Delivery Model)',
      'CPA (Commercial Performance Accelerator)',
      'UMS (Uncertainty Management System)',
      'VFO (Value Flow Optimiser)',
      'CFE (Change Facilitation Engine)',
      'ADF (Adaptive Decision Framework)',
      'GSM (Growth Scaling Model)',
      'SPA (Stakeholder Power Atlas)',
      'RTE (Resonant Trust Engine)',
      'IML (Institutional Memory Layer)',
    ]

    const calibrationPrompt = `You are NemoClaw™, the AI intelligence layer of PIOS — a personal operating system for senior professionals. 
    
Analyse this professional profile and produce a calibration that will make every conversation bespoke, high-value, and coaching-grade.

PROFILE:
${JSON.stringify(extracted, null, 2)}

NemoClaw™ FRAMEWORKS AVAILABLE:
${NEMOCLAW_FRAMEWORKS.join(', ')}

Return ONLY a JSON object with these fields. No markdown:
{
  "communication_register": "peer_executive|professional|coached|mentored",
  "coaching_intensity": "light|balanced|intensive",
  "recommended_frameworks": ["up to 5 most relevant framework short codes e.g. SDL, POM"],
  "growth_areas": ["3-5 specific development areas inferred from career gap analysis"],
  "strengths": ["3-5 genuine strengths evidenced from the CV"],
  "work_life_signals": "brief honest assessment of work-life balance signals from career pattern",
  "decision_style": "analytical|intuitive|consultative|directive",
  "calibration_summary": "A 2-3 sentence personalised NemoClaw™ introduction that shows deep understanding of this person — their level, context, aspirations, and how PIOS will specifically help them. Written in first person as NemoClaw™ addressing the user directly. Make it feel like a senior advisor who has just read their file, not a generic welcome."
}`

    const calibrationRaw = await callClaude(calibrationPrompt,
      'You are NemoClaw™, PIOS\'s AI calibration engine. Return only valid JSON, no markdown.', 1500)

    let calibration: Record<string, unknown> = {}
    try {
      const cleaned = calibrationRaw.replace(/```json|```/g, '').trim()
      calibration = JSON.parse(cleaned)
    } catch {
      // Use safe defaults
      calibration = {
        communication_register: 'professional',
        coaching_intensity: 'balanced',
        recommended_frameworks: ['SDL', 'POM', 'ADF'],
        growth_areas: [],
        strengths: [],
        work_life_signals: '',
        decision_style: 'analytical',
        calibration_summary: 'Welcome to PIOS. I\'ve reviewed your profile and I\'m ready to provide bespoke intelligence across your professional and personal domains.',
      }
    }

    // ── Persist calibration ───────────────────────────────────────────────────
    await svc.from('nemoclaw_calibration').upsert({
      user_id:                user.id,
      education_level:        extracted.education_level as string,
      education_detail:       extracted.education_detail as string,
      career_years:           Number(extracted.career_years ?? 0),
      seniority_level:        extracted.seniority_level as string,
      primary_industry:       extracted.primary_industry as string,
      industries:             (extracted.industries as string[]) ?? [],
      skills:                 (extracted.skills as string[]) ?? [],
      qualifications:         (extracted.qualifications as string[]) ?? [],
      employers:              (extracted.employers as string[]) ?? [],
      key_achievements:       (extracted.key_achievements as string[]) ?? [],
      communication_register: calibration.communication_register as string,
      coaching_intensity:     calibration.coaching_intensity as string,
      recommended_frameworks: (calibration.recommended_frameworks as string[]) ?? [],
      growth_areas:           (calibration.growth_areas as string[]) ?? [],
      strengths:              (calibration.strengths as string[]) ?? [],
      work_life_signals:      calibration.work_life_signals as string,
      decision_style:         calibration.decision_style as string,
      calibration_summary:    calibration.calibration_summary as string,
      updated_at:             new Date().toISOString(),
    }, { onConflict: 'user_id' })

    // ── Update profile with CV status + auto-filled fields ────────────────────
    const profileUpdates: Record<string, unknown> = {
      cv_processing_status: 'complete',
    }
    if (extracted.full_name && !formData.get('skip_autofill'))  profileUpdates.full_name    = extracted.full_name
    if (extracted.job_title)                                     profileUpdates.job_title    = extracted.job_title
    if (extracted.organisation)                                  profileUpdates.organisation = extracted.organisation

    await svc.from('user_profiles').update(profileUpdates).eq('id', user.id)

    // ── Return to client ──────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      autofill: {
        full_name:    extracted.full_name,
        job_title:    extracted.job_title,
        organisation: extracted.organisation,
      },
      calibration: {
        seniority_level:        extracted.seniority_level,
        education_level:        extracted.education_level,
        career_years:           extracted.career_years,
        communication_register: calibration.communication_register,
        coaching_intensity:     calibration.coaching_intensity,
        recommended_frameworks: calibration.recommended_frameworks,
        growth_areas:           calibration.growth_areas,
        strengths:              calibration.strengths,
        decision_style:         calibration.decision_style,
        calibration_summary:    calibration.calibration_summary,
      },
    })

  } catch (err: unknown) {
    console.error('CV API error:', (err as Error).message)
    return NextResponse.json({ error: 'CV processing failed. Please try again.' }, { status: 500 })
  }
}
