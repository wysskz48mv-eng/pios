/**
 * /api/exec/decision — DAA™ Decision Architecture Agent
 * Full decision lifecycle: structure → analyse → decide → log
 * PIOS Sprint 23 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { checkPromptSafety } from '@/lib/security-middleware'

export const runtime    = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles').select('tenant_id,full_name,job_title').eq('id', user.id).single()
    const prof = profile as Record<string,unknown> | null
    if (!prof?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const body = await req.json()
  // Prompt injection defence — IS-POL-008
  const _userText = Object.values(body ?? {}).filter(v => typeof v === 'string').join(' ')
  const _safety = checkPromptSafety(_userText)
  if (!_safety.safe) return NextResponse.json({ error: 'Input rejected: ' + _safety.reason }, { status: 400 })

    const { action } = body as { action: string }

    // ── AI-structure an incoming decision ────────────────────
    if (action === 'structure') {
      const { title, context, framework } = body as { title: string; context: string; framework: string }

      const FRAMEWORK_LENS: Record<string, string> = {
        POM:  'Evaluate this through a portfolio lens — what is the opportunity cost and relative priority vs other initiatives?',
        OAE:  'Evaluate through an organisational alignment lens — what structural, capability, or cultural factors constrain the options?',
        SDL:  'Structure this as a communication decision — who needs to be persuaded and what governing message will land?',
        CVDM: 'Evaluate through a change management lens — what adoption dynamics and resistance patterns will determine success?',
        CPA:  'Evaluate through a competitive lens — how do competitor actions and market dynamics shape the options?',
        SCE:  'Evaluate through an environmental lens — what macro forces (regulatory, economic, technological) most constrain or enable options?',
        AAM:  'Evaluate through an accountability lens — who should own this decision and what governance model should apply?',
      }

      const prompt = `You are the Decision Architecture Agent™ (DAA™). Structure this decision for ${(prof.full_name as string) ?? 'an executive'}.

DECISION: ${title}
CONTEXT: ${context}
FRAMEWORK LENS: ${FRAMEWORK_LENS[framework] ?? 'Apply sound decision architecture'}

Deliver a structured decision brief:

## DECISION CLARITY
Reframe the core decision in one precise sentence. What exactly is being decided?

## OPTIONS MAP
List 3-4 realistic options. For each:
- Label: [option name]
- Upside: key benefit if this works
- Downside: key risk or cost
- Preconditions: what must be true for this to succeed

## CONSTRAINTS & NON-NEGOTIABLES
What boundaries cannot be crossed regardless of option chosen?

## RECOMMENDATION
If you had to decide today with available information: which option and why? Be direct.

## CONFIDENCE & WHAT WOULD CHANGE IT
Rate your confidence 1-10. What single piece of information would most change this recommendation?

Keep the whole analysis under 500 words. Be direct and actionable.`

      const analysis = await callClaude(
        [{ role: 'user', content: prompt }],
        `You are DAA™ — the Decision Architecture Agent inside PIOS. You help executives make high-quality decisions faster. You are direct, structured, and avoid hedging. You never reference named third-party frameworks (BCG, McKinsey, Porter etc.).`,
        900
      )

      // Log analysis to exec_decision_analyses
      const { data: decisionRow } = await supabase
        .from('exec_decisions')
        .select('id').eq('user_id', user.id).eq('title', title).order('created_at', { ascending: false }).limit(1).single()

      if ((decisionRow as Record<string,unknown> | null)?.id) {
        await supabase.from('exec_decision_analyses').insert({
          decision_id:    (decisionRow as Record<string,unknown>).id,
          tenant_id:      prof.tenant_id,
          user_id:        user.id,
          framework_used: framework,
          analysis_text:  analysis,
        })
      }

      return NextResponse.json({ analysis, framework })
    }

    // ── Close a decision with outcome ────────────────────────
    if (action === 'close') {
      const { decision_id, decision_made, rationale, outcome } = body as {
        decision_id: string; decision_made: string; rationale: string; outcome?: string
      }

      const { data, error } = await supabase
        .from('exec_decisions')
        .update({
          status: 'decided',
          decision_made,
          rationale,
          outcome: outcome ?? null,
          decided_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', decision_id).eq('user_id', user.id)
        .select().single()

      if (error) throw new Error(error.message)
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
