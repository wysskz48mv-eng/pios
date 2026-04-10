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

  UMS: {
    name: 'Uncontested Market Scout™',
    desc: 'Identify whitespace opportunities by mapping value curves vs competitors',
    prompt: `Apply the Uncontested Market Scout™ (UMS) to this situation.
Structure your analysis as:
1. CURRENT BATTLEGROUND — map the factors that competitors currently compete on (x-axis) and the relative offering level (y-axis) for the client vs top 3 competitors
2. HIDDEN ASSUMPTIONS — what industry conventions are being taken for granted that could be eliminated or reduced?
3. VALUE CURVE GAPS — which factors could be raised above industry standard, and which new factors could be created that buyers would value but nobody currently offers?
4. WHITESPACE OPPORTUNITY — describe the uncontested market space in one clear paragraph
5. MOVE SEQUENCE — three prioritised actions to shift from the red ocean to the uncontested space`,
  },
  VFO: {
    name: 'Value Flow Optimiser™',
    desc: 'Eliminate waste and unlock flow by mapping value-adding vs non-value-adding steps',
    prompt: `Apply the Value Flow Optimiser™ (VFO) to this situation.
Structure your analysis as:
1. VALUE STREAM MAP — list every step in the process from customer request to delivered outcome
2. WASTE CLASSIFICATION — for each step, categorise as: Value-Adding (customer would pay for it), Required Non-Value-Adding (compliance, regulatory), or Pure Waste (can be eliminated)
3. FLOW BLOCKERS — identify the top 3 bottlenecks creating delays, queues, or rework
4. QUICK WINS — what can be eliminated or simplified in the next 30 days with minimal disruption?
5. FUTURE STATE — describe the redesigned process and quantify the improvement (time, cost, quality)`,
  },
  CFE: {
    name: 'Constraint & Flow Engine™',
    desc: 'Find and resolve the single biggest constraint limiting system throughput',
    prompt: `Apply the Constraint & Flow Engine™ (CFE) to this situation.
Structure your analysis as:
1. IDENTIFY THE CONSTRAINT — what is the single weakest link in this system? Where does work pile up, slow down, or fail most often?
2. EXPLOIT THE CONSTRAINT — how can you get maximum output from the constraint without investment? What changes to policy, scheduling, or focus would help?
3. SUBORDINATE EVERYTHING ELSE — what should every other part of the system do differently to support the constraint rather than create more pressure on it?
4. ELEVATE THE CONSTRAINT — if exploitation and subordination are insufficient, what investment or structural change is needed?
5. REPEAT — once the constraint is resolved, where does the bottleneck move next? Map the cascade.`,
  },
  ADF: {
    name: 'Adaptive Delivery Framework™',
    desc: 'Sprint-based execution layer — structure, cadence, and delivery for any project',
    prompt: `Apply the Adaptive Delivery Framework™ (ADF) to this situation.
Structure your analysis as:
1. DELIVERY ARCHITECTURE — break the work into logical sprints (2-week cycles recommended). What should each sprint deliver, and in what sequence?
2. MINIMUM VIABLE DELIVERY — what is the smallest complete thing that could be delivered first to generate feedback and prove value?
3. DEPENDENCY MAP — what are the key dependencies between workstreams? Where could sequencing errors cause rework?
4. RISK PER SPRINT — for each sprint, what is the single biggest execution risk and how should it be mitigated?
5. GOVERNANCE CADENCE — what decisions need to be made, by whom, and when, across the delivery lifecycle?
6. SUCCESS METRICS — how will you know each sprint has delivered what was intended?`,
  },
  GSM: {
    name: 'Geo-Strategic Monitor™',
    desc: 'Scan geopolitical, regulatory, and macro signals for strategic implications',
    prompt: `Apply the Geo-Strategic Monitor™ (GSM) to this situation.
Analyse the operating environment across six dimensions:
1. POLITICAL & REGULATORY — government direction, policy changes, compliance requirements, licensing risk, political stability
2. ECONOMIC — GDP trajectory, inflation, interest rates, sector-specific economics, capital availability, currency risk
3. SOCIAL & DEMOGRAPHIC — population shifts, workforce trends, consumer behaviour changes, cultural factors
4. TECHNOLOGICAL — emerging technologies, digitisation pace, AI adoption, automation risk, platform shifts
5. ENVIRONMENTAL — climate-related risk, sustainability regulation, ESG investor pressure, physical risk to operations
6. STRATEGIC IMPLICATIONS — rank the top 3 opportunities and top 3 threats arising from this analysis, with a specific recommended response to each`,
  },
  SPA: {
    name: 'Stakeholder Power Atlas™',
    desc: 'Map stakeholder influence and interests to design optimal engagement strategies',
    prompt: `Apply the Stakeholder Power Atlas™ (SPA) to this situation.
Deliver:
1. STAKEHOLDER IDENTIFICATION — list all relevant stakeholders (individuals and groups) affected by or able to affect the outcome
2. POWER-INTEREST MAPPING — plot each stakeholder on two axes: Power to affect the outcome (High/Low) and Interest in the outcome (High/Low)
3. QUADRANT ANALYSIS:
   - High Power / High Interest: Manage closely — what does each one need to see, hear, or receive?
   - High Power / Low Interest: Keep satisfied — what would make them a blocker?
   - Low Power / High Interest: Keep informed — how do they amplify or undermine the narrative?
   - Low Power / Low Interest: Monitor — who in this group could shift quadrant?
4. COALITION STRATEGY — which stakeholders should be brought together, and which must be kept separate?
5. ENGAGEMENT PLAN — for each High Power stakeholder, the specific next action and desired outcome`,
  },
  RTE: {
    name: 'Risk-Tiered Escalation™',
    desc: 'Classify risks by probability × impact and route to the correct decision tier',
    prompt: `Apply the Risk-Tiered Escalation™ (RTE) framework to this situation.
Structure your analysis as:
1. RISK INVENTORY — identify all material risks across: strategic, operational, financial, legal/regulatory, reputational, and people dimensions
2. RISK SCORING — for each risk, estimate: Probability (1-5), Impact (1-5), and Velocity (how fast it could materialise: Slow/Medium/Fast)
3. RISK MATRIX — classify each risk as: Critical (score 16-25, immediate escalation), High (9-15, senior management ownership), Medium (4-8, management monitoring), Low (1-3, operational tracking)
4. ESCALATION ROUTING — map each Critical and High risk to the correct decision-maker and the action trigger that requires escalation
5. MITIGATION PRIORITY — the top 5 risk mitigation actions, ranked by risk-reduction-per-effort, with owner and deadline`,
  },
  IML: {
    name: 'Institutional Memory Layer™',
    desc: 'Extract, codify, and activate pattern intelligence from past engagements',
    prompt: `Apply the Institutional Memory Layer™ (IML) to this situation.
Structure your analysis as:
1. PATTERN RECOGNITION — what does this situation have in common with past cases, decisions, or engagements? Identify recurring structural patterns (client type, challenge type, sector, failure mode).
2. PRECEDENT ANALYSIS — what worked in analogous situations? What failed and why?
3. KNOWLEDGE GAPS — what do we not know about this situation that previous experience suggests we should investigate before acting?
4. APPLICABLE INSIGHTS — pull the 3 most relevant lessons from the pattern library that should directly inform the recommended approach
5. KNOWLEDGE CAPTURE — what new insight from this situation should be codified for future reference? Describe the pattern in a single reusable sentence.`,
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

    const body = await req.json()
    const { action } = body as { action: string }

    // ── Save engagement ──────────────────────────────────────
    if (action === 'save_engagement') {
      const { payload } = body as { payload: Record<string,unknown> }
      const { data, error } = await supabase
        .from('consulting_engagements')
        .insert({ ...payload, user_id: user.id, tenant_id: prof?.tenant_id ?? user.id })
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

      const systemPrompt = `You are the Consulting Strategist Agent™ (CSA™) inside PIOS, serving ${(prof?.full_name as string) ?? 'a senior executive'} (${(prof?.job_title as string) ?? 'consultant'}).

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
        `You are the Consulting Strategist Agent™ (CSA™). You draft professional consulting proposals for ${(prof?.full_name as string) ?? 'a senior consultant'} at ${(prof?.organisation as string) ?? 'a consulting firm'}. Write in a confident, client-facing voice. Never name third-party branded frameworks.`,
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
