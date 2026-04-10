/**
 * /api/ai/train — NemoClaw™ AI Training Agent
 * Manages user-specific context, persona instructions, and memory
 * PIOS Sprint 42 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { callClaude }                from '@/lib/ai/client'
import { checkPromptSafety } from '@/lib/security-middleware'

export const runtime    = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: config } = await (supabase as any)
      .from('exec_intelligence_config')
      .select('*')
      .eq('user_id', user.id)
      .single()

    const { data: profile } = await (supabase as any)
      .from('user_profiles')
      .select('full_name,organisation,persona_type,job_title')
      .eq('id', user.id)
      .single()

    return NextResponse.json({ config: config ?? null, profile })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: prof } = await (supabase as any)
      .from('user_profiles').select('tenant_id,full_name,organisation,job_title,persona_type').eq('id', user.id).single()
    const p = prof as any

    const body = await req.json()
  // Prompt injection defence — IS-POL-008
  const _userText = Object.values(body ?? {}).filter(v => typeof v === 'string').join(' ')
  const _safety = checkPromptSafety(_userText)
  if (!_safety.safe) return NextResponse.json({ error: 'Input rejected: ' + _safety.reason }, { status: 400 })
    const action = body.action as string

    // ── Save training config ──────────────────────────────────────────────────
    if (action === 'save_config') {
      const existing = await (supabase as any).from('exec_intelligence_config')
        .select('id').eq('user_id', user.id).single()

      const payload = {
        user_id:          user.id,
        tenant_id: p?.tenant_id ?? user.id,
        persona_context:  body.persona_context,
        company_context:  body.company_context,
        goals_context:    body.goals_context,
        custom_instructions: body.custom_instructions,
        tone_preference:  body.tone_preference ?? 'professional',
        response_style:   body.response_style ?? 'structured',
        updated_at:       new Date().toISOString(),
      }

      let result
      if ((existing as any)?.data?.id) {
        const { data } = await (supabase as any).from('exec_intelligence_config')
          .update(payload).eq('user_id', user.id).select().single()
        result = data
      } else {
        const { data } = await (supabase as any).from('exec_intelligence_config')
          .insert(payload).select().single()
        result = data
      }

      return NextResponse.json({ config: result })
    }

    // ── Generate AI persona brief from user inputs ────────────────────────────
    if (action === 'generate_context') {
      const { company_desc, goals, working_style } = body as any

      const context = await callClaude([{
        role: 'user',
        content: `You are helping to configure the NemoClaw™ AI context for a PIOS user.

User details:
- Name: ${p.full_name ?? 'Unknown'}
- Role: ${p.job_title ?? p.persona_type ?? 'Professional'}
- Organisation: ${p.organisation ?? 'Not specified'}
- Company description: ${company_desc ?? 'Not provided'}
- Goals: ${goals ?? 'Not provided'}
- Working style: ${working_style ?? 'Not specified'}

Generate a concise but rich AI context block (3-5 sentences) that NemoClaw™ should know about this user to give better, more contextual responses. Focus on:
1. Their role and what decisions they make
2. Their key priorities and success metrics
3. How they prefer to receive information

Then generate 3 specific custom instructions for the AI (each 1 sentence, starting with an action verb like "Always", "When", "Prioritise").

Format:
CONTEXT:
[your context here]

CUSTOM INSTRUCTIONS:
1. [instruction 1]
2. [instruction 2]
3. [instruction 3]`
      }], 'claude-sonnet-4-20250514', 0.4)

      return NextResponse.json({ generated: context })
    }

    // ── Test the configured persona ───────────────────────────────────────────
    if (action === 'test_persona') {
      const { config } = body as any
      const testPrompt = `Hello! I'm testing my NemoClaw™ configuration. Please introduce yourself as my AI assistant, acknowledge who I am and what I do, and tell me the 3 most useful things you can help me with today based on my context.`

      const systemContext = [
        config?.persona_context && `About me: ${config.persona_context}`,
        config?.company_context && `My company: ${config.company_context}`,
        config?.goals_context && `My current goals: ${config.goals_context}`,
        config?.custom_instructions && `My custom instructions: ${config.custom_instructions}`,
      ].filter(Boolean).join('\n\n')

      const response = await callClaude([{
        role: 'user',
        content: systemContext ? `[Context]\n${systemContext}\n\n[User message]\n${testPrompt}` : testPrompt
      }], 'claude-sonnet-4-20250514', 0.7)

      return NextResponse.json({ response })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
