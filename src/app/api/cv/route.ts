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

    // Validate file type
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|docx|txt)$/i)) {
      return NextResponse.json({ error: 'Please upload a PDF, DOCX, or TXT file.' }, { status: 400 })
    }

    // Validate size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be under 5MB.' }, { status: 400 })
    }

    // ── Mark as processing ──────────────────────────────────────────────────
    const svc = createServiceClient()
    await svc.from('user_profiles').update({
      cv_filename: file.name,
      cv_processing_status: 'processing',
      cv_uploaded_at: new Date().toISOString(),
    }).eq('id', user.id)

    // ── Upload to Supabase Storage ──────────────────────────────────────────
    const storagePath = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const bytes = await file.arrayBuffer()

    const { error: uploadError } = await supabase.storage
      .from('pios-cv')
      .upload(storagePath, bytes, { contentType: file.type, upsert: true })

    if (uploadError) console.warn('CV storage upload failed:', uploadError.message)
    else await svc.from('user_profiles').update({ cv_storage_path: storagePath }).eq('id', user.id)

    // ── Extract text from file ──────────────────────────────────────────────
    let cvText = ''

    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      cvText = await file.text()

    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      try {
        const pdfParse = (await import('pdf-parse')).default
        const result   = await pdfParse(Buffer.from(bytes))
        cvText = result.text ?? ''
      } catch (e) {
        console.warn('pdf-parse failed:', e)
      }

    } else if (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.endsWith('.docx')
    ) {
      try {
        const mammoth = await import('mammoth')
        const result  = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
        cvText = result.value ?? ''
      } catch (e) {
        console.warn('mammoth failed:', e)
      }
    }

    if (!cvText || cvText.length < 50) {
      await svc.from('user_profiles').update({ cv_processing_status: 'failed' }).eq('id', user.id)
      return NextResponse.json({ error: 'Could not extract text from CV. Please try a plain text or PDF version.' }, { status: 422 })
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
