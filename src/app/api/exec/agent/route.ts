/**
 * /api/exec/agent — EOSA™ Executive Operating System Agent
 * Modes: brief | decision | review | okr_commentary | stakeholder_brief | time_audit
 * PIOS Sprint 22 | VeritasIQ Technologies Ltd
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

    const body = await req.json()
  // Prompt injection defence — IS-POL-008
  const _userText = Object.values(body ?? {}).filter(v => typeof v === 'string').join(' ')
  const _safety = checkPromptSafety(_userText)
  if (!_safety.safe) return NextResponse.json({ error: 'Input rejected: ' + _safety.reason }, { status: 400 })

    const { mode, context } = body as {
      mode: 'brief' | 'decision' | 'review' | 'okr_commentary' | 'stakeholder_brief' | 'time_audit' | 'report_pack'
      context: Record<string, unknown>
    }

    // Fetch live executive data
    const [profileR, principlesR, openDecisionsR, latestReviewR, okrsR, upcomingStakeholdersR] = await Promise.all([
      supabase.from('user_profiles').select('full_name,job_title,organisation,persona_type').eq('id', user.id).single(),
      supabase.from('exec_principles').select('title,category').eq('user_id', user.id).order('sort_order').limit(10),
      supabase.from('exec_decisions').select('title,context,status,framework_used').eq('user_id', user.id).eq('status', 'open').limit(5),
      supabase.from('exec_reviews').select('content,wins,blockers,focus_next,okr_health').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('exec_okrs').select('title,health,progress,period').eq('user_id', user.id).eq('status', 'active'),
      supabase.from('exec_stakeholders')
        .select('name,role,organisation,importance,next_touchpoint,open_commitments')
        .eq('user_id', user.id)
        .lte('next_touchpoint', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])
        .order('importance').limit(5),
    ])

    const profile = profileR.data as Record<string, unknown> | null
    const name    = (profile?.full_name as string) ?? 'Executive'

    const systemPrompt = `You are EOSA™ — the Executive Operating System Agent inside PIOS, serving ${name} (${(profile?.job_title as string) ?? 'CEO'} at ${(profile?.organisation as string) ?? 'their organisation'}).

PERSONA: ${(profile?.persona_type as string) ?? 'executive'}
LIVE PRINCIPLES: ${JSON.stringify(principlesR.data ?? [])}
OPEN DECISIONS: ${JSON.stringify(openDecisionsR.data ?? [])}
LATEST REVIEW: ${JSON.stringify(latestReviewR.data ?? {})}
ACTIVE OKRs: ${JSON.stringify(okrsR.data ?? [])}
UPCOMING STAKEHOLDERS: ${JSON.stringify(upcomingStakeholdersR.data ?? [])}

BEHAVIOUR:
- Direct, senior, action-oriented. No pleasantries or hedging.
- Reference live data naturally — you know their situation.
- Proprietary frameworks: POM™ (portfolio), OAE™ (org alignment), SDL™ (communication), CVDM™ (change), CPA™ (competitive), SCE™ (environment), AAM™ (accountability)
- Never reference BCG, McKinsey, Kotter, Porter, or any third-party branded frameworks by name.
- Output structured, scannable content — short headers and bullet points.
- Tone: trusted senior advisor.`

    const prompts: Record<string, string> = {
      brief: `Generate today's executive operating brief for ${name}. Include:
1. SITUATION SNAPSHOT — one paragraph, what matters most right now
2. DECISIONS NEEDING ACTION — any open decisions requiring movement
3. OKR PULSE — health check on active objectives, flag any drift
4. STAKEHOLDER ALERTS — anyone overdue for contact or with open commitments
5. STRATEGIC FOCUS — one clear priority for this week
Executive reading time: under 2 minutes.`,

      decision: `Provide structured decision support for: ${JSON.stringify(context)}
1. SITUATION CLARITY — reframe the core decision in one sentence
2. OPTIONS MAP — structure realistic options with key trade-offs
3. CONSTRAINTS — what non-negotiables apply?
4. RECOMMENDATION — what would you advise and why?
5. RISK FLAGS — two most likely failure modes`,

      review: `Generate a structured ${(context.cadence as string) ?? 'weekly'} review pre-populated from available data:
1. WINS THIS ${String(context.cadence ?? 'week').toUpperCase()} — draw from recent OKR progress
2. BLOCKERS & RISKS — flag anything at-risk or off-track
3. DECISIONS MADE — summarise any closed decisions
4. NEXT PERIOD FOCUS — top 3 priorities based on OKR health and open decisions
5. PRINCIPLES CHECK — are actions aligned with stated principles?`,

      okr_commentary: `Analyse active OKRs and provide:
1. OVERALL HEALTH — traffic light summary
2. DRIFT ANALYSIS — objectives showing worrying trajectory
3. RECOMMENDED ACTIONS — what needs to change this week
4. WINS TO ACKNOWLEDGE — progress deserving recognition
Keep under 200 words.`,

      stakeholder_brief: `Generate a pre-meeting brief for: ${JSON.stringify(context)}
1. WHO THEY ARE — role and why they matter
2. RELATIONSHIP HEALTH — based on last interaction and open commitments
3. THEIR LIKELY AGENDA — what they probably want from this meeting
4. YOUR OBJECTIVES — what you should aim to achieve
5. OPEN ITEMS — commitments to close or questions to ask`,

      time_audit: `Analyse this time block configuration and provide a Time Sovereignty audit: ${JSON.stringify(context)}
1. STRATEGIC TIME RATIO — % of week protected for deep/strategic work
2. CALENDAR TRAPS — where busyness is likely replacing strategy
3. MISSING BLOCKS — what should be scheduled but isn't
4. RECOMMENDATION — top 2 changes to improve time sovereignty`,
    }

    const content = await callClaude(
      [{ role: 'user', content: (prompts as any)[mode] ?? (prompts as any).brief }],
      systemPrompt,
      1200
    )

    // Persist daily brief to exec_reviews
    if (mode === 'brief') {
      const { data: prof2 } = await supabase
        .from('user_profiles').select('tenant_id').eq('id', user.id).single()
      if ((prof2 as Record<string,unknown> | null)?.tenant_id) {
        await supabase.from('exec_reviews').insert({
          user_id:    user.id,
          tenant_id:  (prof2 as Record<string,unknown>).tenant_id,
          cadence:    'daily',
          title:      `Executive Brief — ${new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`,
          ai_summary: content,
        })
      }
    }

    return NextResponse.json({ content, mode })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
