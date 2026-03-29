import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { checkPromptSafety } from '@/lib/security-middleware'

/**
 * POST /api/consulting/proposals/generate
 * Uses NemoClaw™ calibration + Anthropic to draft a proposal
 * in the user's communication register.
 *
 * Body: { template, client_name, title, scope, day_rate, estimated_days, expenses, fee_total }
 * Returns: { content: string }
 *
 * VeritasIQ Technologies Ltd · PIOS Sprint K
 */

export const dynamic     = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    // Spend gate — prevent credit drain (max_tokens:2000, expensive route)
    const { data: credits } = await supabase
      .from('exec_intelligence_config').select('ai_calls_used,ai_calls_limit')
      .eq('user_id', user.id).single()
    if (credits && (credits.ai_calls_used ?? 0) >= (credits.ai_calls_limit ?? 200)) {
      return NextResponse.json({ error: 'AI credit limit reached — upgrade to generate more proposals.' }, { status: 429 })
    }

    const body = await req.json()
  // Prompt injection defence — IS-POL-008
  const _userText = Object.values(body ?? {}).filter(v => typeof v === 'string').join(' ')
  const _safety = checkPromptSafety(_userText)
  if (!_safety.safe) return NextResponse.json({ error: 'Input rejected: ' + _safety.reason }, { status: 400 })

    const { template, client_name, title, scope, day_rate, estimated_days, expenses, fee_total } = body

    // Fetch NemoClaw calibration
    const { data: calib } = await supabase
      .from('nemoclaw_calibration')
      .select('calibration_summary, seniority_level, primary_industry, employers, qualifications, communication_register')
      .eq('user_id', user.id)
      .single()

    // Fetch user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single()

    const userName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Consultant'

    const systemPrompt = `You are NemoClaw™, an AI writing assistant for ${userName}.
${calib?.calibration_summary ? `PROFILE: ${calib.calibration_summary}` : ''}
${calib?.seniority_level ? `SENIORITY: ${calib.seniority_level}` : ''}
${calib?.primary_industry ? `INDUSTRY: ${calib.primary_industry}` : ''}
${calib?.employers?.length ? `EMPLOYERS: ${(calib.employers as string[]).join(', ')}` : ''}
${calib?.qualifications?.length ? `QUALIFICATIONS: ${(calib.qualifications as string[]).join(', ')}` : ''}

COMMUNICATION REGISTER: ${calib?.communication_register ?? 'professional'}
Write in a direct, confident, authoritative tone. No fluff. Senior professional voice.
UK English. British spellings. No Americanisms.

You are writing a professional consulting proposal document in Markdown format.
The proposal should be complete and ready to send to a client.`

    const userPrompt = `Draft a professional consulting proposal with these details:

CLIENT: ${client_name || 'Prospective client'}
ENGAGEMENT TYPE: ${template || 'Consulting'}
TITLE: ${title}
SCOPE (expand these bullet points into full professional paragraphs):
${scope}

FEE STRUCTURE:
${day_rate ? `Day rate: £${day_rate}` : ''}
${estimated_days ? `Estimated duration: ${estimated_days} days` : ''}
${expenses ? `Estimated expenses: £${expenses}` : ''}
${fee_total ? `Total investment: £${fee_total.toLocaleString()}` : ''}

Write a complete proposal document in Markdown with these sections:
1. Executive Summary (2-3 sentences — the key value proposition)
2. Understanding of Brief (show you understand what they need)
3. Our Approach (methodology — expand scope bullets into paragraphs)
4. Deliverables (concrete outputs they will receive)
5. Team + Credentials (reference ${userName}'s background and qualifications)
6. Investment (fee table with day rate, days, total)
7. Terms + Validity (standard professional terms, 30-day validity)

Keep it professional, concise, and persuasive. This goes directly to a client.`

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await client.messages.create({
      model:      'claude-sonnet-4-5-20251001',
      max_tokens: 2000,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    const content = message.content[0].type === 'text' ? message.content[0].text : ''

    // Deduct AI credit
    await supabase.from('exec_intelligence_config')
      .update({ ai_calls_used: supabase.rpc('increment', { x: 1 }) as unknown as number })
      .eq('user_id', user.id)

    return NextResponse.json({ content })

  } catch (err) {
    console.error('[proposals/generate]', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
