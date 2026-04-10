// pios-legal-academic-intelligence-agent
// Legal & regulatory research + academic intelligence
// Subscription-gated: free=1x/5days, paid=4x/day
//
// PIOS v3.7.2 | VeritasIQ Technologies Ltd

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { checkAgentGate, logExecution, getSupabase, type AgentRequest } from '../_shared/agent-gate.ts'

const AGENT_NAME = 'pios-legal-academic-intelligence-agent'
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')

Deno.serve(async (req: Request) => {
  const started = Date.now()

  try {
    const body: AgentRequest = await req.json()
    const { user_id, trigger_type } = body

    if (!user_id) {
      return json({ error: 'user_id required' }, 400)
    }

    // ── Subscription gate ───────────────────────────────────────────────────
    const gate = await checkAgentGate(body)
    if (!gate.allowed) {
      await logExecution(user_id, AGENT_NAME, 'gated', gate.subscription?.subscription_tier as string ?? 'free', trigger_type, null, Date.now() - started)
      return json({
        status: gate.message === 'Advanced agent analysis available with subscription' ? 'UNAVAILABLE' : 'SCHEDULED',
        message: gate.message,
        next_run: gate.next_run,
        upgrade_message: 'Get 4x daily runs with Pro subscription',
      }, gate.status)
    }

    const tier = gate.subscription?.subscription_tier as string ?? 'free'

    // ── Gather user context ─────────────────────────────────────────────────
    const supabase = getSupabase()

    const [academicR, thesisR, literatureR, tasksR] = await Promise.all([
      supabase.from('academic_modules').select('title, status, domain').eq('user_id', user_id).limit(10),
      supabase.from('thesis_chapters').select('title, status, word_count').eq('user_id', user_id).limit(10),
      supabase.from('literature_items').select('title, authors, year, relevance_score').eq('user_id', user_id).order('created_at', { ascending: false }).limit(15),
      supabase.from('tasks').select('title, status, domain, due_date').eq('user_id', user_id).eq('domain', 'academic').eq('status', 'active').limit(10),
    ])

    const context = {
      modules: academicR.data ?? [],
      thesis: thesisR.data ?? [],
      recent_literature: literatureR.data ?? [],
      academic_tasks: tasksR.data ?? [],
    }

    // ── Run AI analysis ─────────────────────────────────────────────────────
    if (!ANTHROPIC_KEY) {
      await logExecution(user_id, AGENT_NAME, 'failed', tier, trigger_type, { error: 'No API key' }, Date.now() - started)
      return json({ status: 'ERROR', message: 'ANTHROPIC_API_KEY not configured' }, 500)
    }

    const systemPrompt = `You are the PIOS Legal & Academic Intelligence Agent for a DBA/PhD candidate who is also a senior FM consultant and SaaS founder.

Analyze the user's academic context and provide:
1. REGULATORY UPDATES: Key legal/regulatory changes relevant to their research domains
2. ACADEMIC TRENDS: Emerging research directions in their field
3. LITERATURE GAPS: Areas where their literature review could be strengthened
4. DEADLINE AWARENESS: Upcoming academic milestones and compliance deadlines
5. CROSS-DOMAIN INSIGHTS: Where their FM consulting work intersects with academic research

Return JSON: {
  "regulatory_updates": [{"title": string, "relevance": number, "summary": string}],
  "academic_trends": [{"area": string, "significance": string}],
  "literature_gaps": [{"gap": string, "suggested_search": string}],
  "deadlines": [{"item": string, "urgency": string}],
  "cross_domain": [{"insight": string, "actionable": boolean}],
  "briefing_summary": string
}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Academic context:\n${JSON.stringify(context, null, 2).slice(0, 3000)}\n\nProvide your intelligence briefing as JSON.`,
        }],
      }),
    })

    let result: Record<string, unknown> = {}
    if (res.ok) {
      const data = await res.json()
      const text = data.content?.[0]?.text ?? '{}'
      try {
        result = JSON.parse(text.replace(/```json\n?/g, '').replace(/```/g, '').trim())
      } catch {
        result = { raw_output: text, parse_error: true }
      }
    } else {
      result = { error: `Anthropic API ${res.status}` }
    }

    // ── Log and return ──────────────────────────────────────────────────────
    const nextRun = await logExecution(user_id, AGENT_NAME, 'success', tier, trigger_type, result, Date.now() - started)

    return json({
      status: 'SUCCESS',
      agent: AGENT_NAME,
      result,
      next_run: nextRun,
      subscription_tier: tier,
      execution_ms: Date.now() - started,
    })

  } catch (err) {
    return json({ status: 'ERROR', error: (err as Error).message }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
