/**
 * /api/consulting — CSA™ Consulting Strategist Agent + engagement CRUD
 * PIOS Sprint 23 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'

export const runtime    = 'nodejs'
export const maxDuration = 60

// Proprietary framework descriptors — no third-party IP named
const FRAMEWORKS: Record<string, { name: string; desc: string; prompt: string }> = {
  POM: {
    name: 'Portfolio Opportunity Matrix™',
    desc: 'Prioritise initiatives by growth potential and competitive position',
    prompt: `Apply the Portfolio Opportunity Matrix™ (POM) to this situation.
Structure your analysis as:
1. PORTFOLIO LANDSCAPE — map the key initiatives/products across two axes: market attractiveness (growth, size, margin) and competitive strength (differentiation, capability, position)
2. QUADRANT CLASSIFICATION — classify each element: Star (high/high), Question Mark (high/low), Cash Engine (low/high), Review (low/low)
3. RESOURCE ALLOCATION — where should investment concentrate and where should it reduce?
4. STRATEGIC RECOMMENDATION — the 2-3 portfolio moves that will create the most value`,
  },
  OAE: {
    name: 'Organisational Alignment Engine™',
    desc: 'Diagnose misalignment across strategy, structure, systems, and people',
    prompt: `Apply the Organisational Alignment Engine™ (OAE) to this situation.
Structure your analysis as:
1. ALIGNMENT DIAGNOSTIC — assess coherence across: Strategy (direction, goals), Structure (reporting, teams, decision rights), Systems (processes, tools, incentives), Shared Values (culture, norms), Staff (capability, capacity), Skills (competencies), Style (leadership)
2. MISALIGNMENT GAPS — where are the most significant tensions or contradictions?
3. ROOT CAUSE — what is the primary driver of misalignment?
4. REALIGNMENT ACTIONS — the 3 highest-leverage interventions, sequenced`,
  },
  SDL: {
    name: 'Strategic Dialogue Layer™',
    desc: 'Structure executive communication for maximum persuasion and clarity',
    prompt: `Apply the Strategic Dialogue Layer™ (SDL) to structure this communication.
Deliver:
1. SITUATION — the context the audience already accepts as true
2. COMPLICATION — what has changed or what tension exists
3. QUESTION — the key question this raises for the audience
4. ANSWER — your recommended response (the governing thought)
5. SUPPORTING ARGUMENTS — 3 logical pillars that support the answer
6. DRAFTED COMMUNICATION — write the actual message/section using this structure`,
  },
  CVDM: {
    name: 'Change Velocity & Direction Model™',
    desc: 'Sequence and manage organisational change for adoption and momentum',
    prompt: `Apply the Change Velocity & Direction Model™ (CVDM) to this change initiative.
Structure your analysis as:
1. URGENCY ASSESSMENT — how strong and credible is the case for change? What data makes it undeniable?
2. COALITION — who are the 5-8 people whose support is essential, and how ready are they?
3. VISION & NARRATIVE — in one paragraph: what does success look like and why does it matter?
4. QUICK WINS — what can be demonstrated within 90 days to build momentum?
5. RESISTANCE MAP — where will opposition concentrate and how should it be managed?
6. EMBEDDING — what structural changes (systems, incentives, roles) will lock in the change?`,
  },
  CPA: {
    name: 'Competitive Position Analyser™',
    desc: 'Assess competitive dynamics and identify strategic positioning options',
    prompt: `Apply the Competitive Position Analyser™ (CPA) to this competitive situation.
Structure your analysis as:
1. COMPETITIVE INTENSITY — assess the key forces shaping competition: incumbent rivalry, new entrant threat, substitute risk, supplier dynamics, buyer power
2. CURRENT POSITION — where does the client sit and what is their differentiation?
3. COMPETITOR MOVES — what are the most significant competitive threats or opportunities in the next 12-24 months?
4. POSITIONING OPTIONS — three distinct strategic positions available, with trade-offs for each
5. RECOMMENDED MOVE — which position to pursue and why, with the key capability requirements`,
  },
  SCE: {
    name: 'Strategic Context Engine™',
    desc: 'Scan the external environment for threats, opportunities and strategic implications',
    prompt: `Apply the Strategic Context Engine™ (SCE) to this situation.
Analyse the macro environment across:
1. SOCIO-CULTURAL — demographic shifts, behavioural changes, social trends affecting the business
2. TECHNOLOGICAL — emerging tech, digitisation, automation, AI that creates opportunity or risk
3. ECONOMIC — macro conditions, inflation, capital availability, sector economics
4. ENVIRONMENTAL — climate risk, regulation, ESG expectations, physical risk
5. POLITICAL & REGULATORY — policy direction, compliance requirements, geopolitical factors
6. STRATEGIC IMPLICATIONS — the 3 most significant opportunities and 3 most significant threats, with suggested responses`,
  },
  AAM: {
    name: 'Accountability Architecture™',
    desc: 'Map decision rights and accountability to eliminate confusion and delays',
    prompt: `Apply the Accountability Architecture™ (AAM) to this situation.
Deliver:
1. DECISION INVENTORY — list the 8-12 most important decisions in this domain
2. ACCOUNTABILITY MAP — for each decision: who is Accountable (one person), who is Responsible (does the work), who must be Consulted, who must be Informed
3. CONFUSION ZONES — where are accountability gaps, overlaps, or ambiguities currently causing friction?
4. REDESIGN RECOMMENDATIONS — the 3-5 changes to decision rights that would most improve speed and clarity
5. IMPLEMENTATION — how to communicate and embed the new model without triggering resistance`,
  },
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode')

    if (mode === 'frameworks') {
      return NextResponse.json({
        frameworks: Object.entries(FRAMEWORKS).map(([key, f]) => ({
          key, name: f.name, desc: f.desc
        }))
      })
    }

    const { data: engagements } = await supabase
      .from('consulting_engagements')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    return NextResponse.json({ engagements: engagements ?? [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles').select('tenant_id,full_name,job_title,organisation').eq('id', user.id).single()
    const prof = profile as Record<string,unknown> | null
    if (!prof?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const body = await req.json()
    const { action } = body as { action: string }

    // ── Save engagement ──────────────────────────────────────
    if (action === 'save_engagement') {
      const { payload } = body as { payload: Record<string,unknown> }
      const { data, error } = await supabase
        .from('consulting_engagements')
        .insert({ ...payload, user_id: user.id, tenant_id: prof.tenant_id })
        .select().single()
      if (error) throw new Error(error.message)
      return NextResponse.json({ data }, { status: 201 })
    }

    // ── Apply framework (CSA™ agent) ─────────────────────────
    if (action === 'apply_framework') {
      const { framework_key, situation, engagement_id } = body as {
        framework_key: string
        situation: string
        engagement_id?: string
      }

      const fw = FRAMEWORKS[framework_key]
      if (!fw) return NextResponse.json({ error: 'Unknown framework' }, { status: 400 })

      const systemPrompt = `You are the Consulting Strategist Agent™ (CSA™) inside PIOS, serving ${(prof.full_name as string) ?? 'a senior executive'} (${(prof.job_title as string) ?? 'consultant'}).

You apply proprietary PIOS consulting frameworks. You are direct, analytical, and senior in your reasoning.
You never reference BCG, McKinsey, Bain, Kotter, Porter, Ansoff, or any named third-party consulting IP.
You cite PIOS proprietary frameworks only: POM™, OAE™, SDL™, CVDM™, CPA™, SCE™, AAM™.
All analysis should be specific, actionable, and immediately useful.`

      const userPrompt = `${fw.prompt}

SITUATION / CONTEXT:
${situation}`

      const analysis = await callClaude(
        [{ role: 'user', content: userPrompt }],
        systemPrompt,
        1400
      )

      // Persist to engagement if provided
      if (engagement_id) {
        await supabase.from('consulting_engagements')
          .update({ ai_output: analysis, framework_used: framework_key, updated_at: new Date().toISOString() })
          .eq('id', engagement_id).eq('user_id', user.id)
      }

      return NextResponse.json({ analysis, framework: fw.name })
    }

    // ── Generate proposal ────────────────────────────────────
    if (action === 'generate_proposal') {
      const { client_name, engagement_type, scope } = body as {
        client_name: string; engagement_type: string; scope: string
      }

      const proposal = await callClaude(
        [{ role: 'user', content: `Generate an executive summary section for a consulting proposal:
Client: ${client_name}
Engagement type: ${engagement_type}
Scope: ${scope}

Deliver:
1. EXECUTIVE SUMMARY (90 words) — compelling, client-centric
2. OUR APPROACH (3 bullets) — methodology without revealing IP
3. KEY DELIVERABLES (3 bullets) — tangible outputs
4. INDICATIVE TIMELINE — high-level phasing

Be professional, industry-specific, and persuasive.` }],
        `You are the Consulting Strategist Agent™ (CSA™). You draft professional consulting proposals for ${(prof.full_name as string) ?? 'a senior consultant'} at ${(prof.organisation as string) ?? 'a consulting firm'}. Write in a confident, client-facing voice. Never name third-party branded frameworks.`,
        800
      )

      return NextResponse.json({ proposal })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
