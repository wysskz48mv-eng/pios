// @ts-ignore
/**
 * POST /api/cv — CV Upload + NemoClaw™ Intelligence Calibration
 * GET  /api/cv — return existing calibration for current user
 * PIOS v3.0 · VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { callClaude as callClaudeAI } from '@/lib/ai/client'

import { checkPromptSafety } from '@/lib/security-middleware'

export const runtime     = 'nodejs'
export const maxDuration = 60

async function callClaude(prompt: string, system: string, maxTokens = 1500): Promise<string> {
  return callClaudeAI([{ role: 'user', content: prompt }], system, maxTokens)
}

export async function GET() {
  try {
    const supabase = createClient()
    const svc      = createServiceClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: cal }     = await svc.from('nemoclaw_calibration').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single()
    const { data: profile } = await svc.from('user_profiles').select('cv_filename, cv_uploaded_at, cv_processing_status').eq('id', user.id).single()
    return NextResponse.json({ calibration: cal, cv: profile })
  } catch {
    return NextResponse.json({ calibration: null, cv: null })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const svc      = createServiceClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file     = formData.get('cv') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const fname = file.name.toLowerCase()
    console.log('[CV]', fname, file.type, file.size)

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be under 5MB.' }, { status: 400 })
    }

    const isTxt  = fname.endsWith('.txt')  || file.type.includes('text/plain')
    const isPdf  = fname.endsWith('.pdf')  || file.type.includes('pdf')
    const isWord = fname.endsWith('.docx') || fname.endsWith('.doc')
                || file.type.includes('wordprocessingml') || file.type.includes('msword')
                || file.type.includes('openxmlformats')

    if (!isTxt && !isPdf && !isWord) {
      return NextResponse.json({ error: `Cannot read "${file.name}". Upload PDF, DOCX, DOC, or TXT.` }, { status: 400 })
    }

    await svc.from('user_profiles').update({
      cv_filename: file.name, cv_processing_status: 'processing', cv_uploaded_at: new Date().toISOString(),
    }).eq('id', user.id)

    const bytes = await file.arrayBuffer()
    const buf   = Buffer.from(bytes)
    let cvText  = ''

    if (isTxt) {
      cvText = await file.text()
      console.log('[CV] txt:', cvText.length)
    }

    if (!cvText && isPdf) {
      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01', 'anthropic-beta': 'pdfs-2024-09-25' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001', max_tokens: 4000,
            messages: [{ role: 'user', content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } },
              { type: 'text', text: 'Extract all text from this CV. Output raw text only, no commentary.' },
            ]}],
          }),
        })
        const d = await r.json()
        cvText  = d?.content?.[0]?.text ?? ''
        console.log('[CV] claude-pdf:', cvText.length, d?.error?.message ?? 'ok')
      } catch (e: any) { console.error('[CV] claude-pdf:', e.message) }
    }

    if (!cvText && isWord) {
      // Extract w:t XML runs — DOCX is a ZIP of XML, this needs no libraries
      const str  = buf.toString('binary')
      const runs: string[] = []
      const rx   = /<w:t(?:[^>]*)?>([^<]*)<\/w:t>/g
      let   m:   RegExpExecArray | null
      while ((m = rx.exec(str)) !== null) { if (m[1]?.trim()) runs.push(m[1].trim()) }
      console.log('[CV] docx xml runs:', runs.length)
      if (runs.length >= 5) cvText = runs.join(' ').replace(/\s+/g, ' ').trim()
    }

    if (!cvText && isWord) {
      try {
        // @ts-ignore
        const { extractRawText } = await import('mammoth')
        const r = await extractRawText({ buffer: buf })
        cvText  = r.value ?? ''
        console.log('[CV] mammoth:', cvText.length)
      } catch (e: any) { console.error('[CV] mammoth:', e.message) }
    }

    console.log('[CV] final:', cvText.trim().length, 'chars')

    if (!cvText || cvText.trim().length < 30) {
      await svc.from('user_profiles').update({ cv_processing_status: 'failed' }).eq('id', user.id)
      const tip = isPdf ? 'Ensure PDF has selectable text (not a scanned image).' : 'Try File → Save As → PDF in Word, then upload the PDF.'
      return NextResponse.json({ error: `Could not read CV text. ${tip}` }, { status: 422 })
    }

    // PII strip before inference — GDPR Art.25
    const cvTextSafe = cvText
      .replace(/\b[\w.+-]+@[\w-]+\.\w+\b/g, '[EMAIL]')
      .replace(/\b(?:\+\d[\d\s\-()\.]{6,14}|\b0\d{9,10})\b/g, '[PHONE]')
      .replace(/\b[A-Z]{1,2}\d{1,2}\s*\d[A-Z]{2}\b/g, '[POSTCODE]')

    const extractionRaw = await callClaude(
      `Analyse this CV and return ONLY valid JSON (no markdown) with these fields:
{"full_name":"","job_title":"","organisation":"","email":"","education_level":"doctoral|masters|bachelors|professional|other","education_detail":"","qualifications":[],"career_years":0,"seniority_level":"c_suite|senior|mid|junior|student","primary_industry":"","industries":[],"employers":[],"skills":[],"key_achievements":[]}

CV TEXT:
${cvTextSafe.slice(0, 8000)}`,
      'You are a precise CV parser. Return only valid JSON, no markdown.', 2000)

    let extracted: Record<string, unknown> = {}
    try { extracted = JSON.parse(extractionRaw.replace(/```json|```/g, '').trim()) } catch { /* continue */ }

    const calibrationRaw = await callClaude(
      `You are NemoClaw™. Analyse this profile and return ONLY valid JSON:
{"communication_register":"peer_executive|professional|coached|mentored","coaching_intensity":"light|balanced|intensive","recommended_frameworks":["SDL","POM"],"growth_areas":[],"strengths":[],"work_life_signals":"","decision_style":"analytical|intuitive|consultative|directive","calibration_summary":"2-3 sentence personalised intro as NemoClaw™ in first person addressing the user directly."}

PROFILE: ${JSON.stringify(extracted, null, 2)}`,
      "You are NemoClaw™. Return only valid JSON, no markdown.", 1500)

    let calibration: Record<string, unknown> = {}
    try { calibration = JSON.parse(calibrationRaw.replace(/```json|```/g, '').trim()) } catch {
      calibration = { communication_register:'professional', coaching_intensity:'balanced', recommended_frameworks:['SDL','POM','ADF'], growth_areas:[], strengths:[], work_life_signals:'', decision_style:'analytical', calibration_summary:"Welcome to PIOS. I've reviewed your profile and I'm ready to provide bespoke intelligence." }
    }

    await svc.from('nemoclaw_calibration').upsert({
      user_id: user.id,
      education_level: extracted.education_level as string, education_detail: extracted.education_detail as string,
      career_years: Number(extracted.career_years ?? 0), seniority_level: extracted.seniority_level as string,
      primary_industry: extracted.primary_industry as string,
      industries: (extracted.industries as string[]) ?? [], skills: (extracted.skills as string[]) ?? [],
      qualifications: (extracted.qualifications as string[]) ?? [], employers: (extracted.employers as string[]) ?? [],
      key_achievements: (extracted.key_achievements as string[]) ?? [],
      communication_register: calibration.communication_register as string, coaching_intensity: calibration.coaching_intensity as string,
      recommended_frameworks: (calibration.recommended_frameworks as string[]) ?? [],
      growth_areas: (calibration.growth_areas as string[]) ?? [], strengths: (calibration.strengths as string[]) ?? [],
      work_life_signals: calibration.work_life_signals as string, decision_style: calibration.decision_style as string,
      calibration_summary: calibration.calibration_summary as string, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    const profileUpdates: Record<string, unknown> = { cv_processing_status: 'complete' }
    if (extracted.full_name    && !formData.get('skip_autofill')) profileUpdates.full_name    = extracted.full_name
    if (extracted.job_title)                                       profileUpdates.job_title    = extracted.job_title
    if (extracted.organisation)                                    profileUpdates.organisation = extracted.organisation
    await svc.from('user_profiles').update(profileUpdates).eq('id', user.id)

    return NextResponse.json({
      success:     true,
      autofill:    { full_name: extracted.full_name, job_title: extracted.job_title, organisation: extracted.organisation },
      calibration: { seniority_level: extracted.seniority_level, education_level: extracted.education_level, career_years: extracted.career_years, communication_register: calibration.communication_register, coaching_intensity: calibration.coaching_intensity, recommended_frameworks: calibration.recommended_frameworks, growth_areas: calibration.growth_areas, strengths: calibration.strengths, decision_style: calibration.decision_style, calibration_summary: calibration.calibration_summary },
    })

  } catch (err: unknown) {
    console.error('[CV] unhandled:', (err as Error).message)
    return NextResponse.json({ error: 'CV processing failed. Please try again.' }, { status: 500 })
  }
}
