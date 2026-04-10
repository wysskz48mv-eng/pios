// pios-world-model-agent
// Scenario analysis & world modeling for multi-domain executives
// Subscription-gated: free=1x/5days, paid=4x/day
//
// PIOS v3.7.2 | VeritasIQ Technologies Ltd

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { checkAgentGate, logExecution, getSupabase, type AgentRequest } from '../_shared/agent-gate.ts'

const AGENT_NAME = 'pios-world-model-agent'
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

    // ── Gather cross-domain context ─────────────────────────────────────────
    const supabase = getSupabase()

    const [projectsR, decisionsR, okrsR, stakeholdersR, tasksR, expensesR] = await Promise.all([
      supabase.from('projects').select('title, status, domain, progress').eq('user_id', user_id).eq('status', 'active').limit(10),
      supabase.from('exec_decisions').select('title, status, framework_used, decided_at').eq('user_id', user_id).order('created_at', { ascending: false }).limit(10),
      supabase.from('exec_okrs').select('title, health, progress, period').eq('user_id', user_id).eq('status', 'active').limit(5),
      supabase.from('exec_stakeholders').select('name, organisation, importance, health_score').eq('user_id', user_id).limit(10),
      supabase.from('tasks').select('title, domain, status, priority, due_date').eq('user_id', user_id).in('status', ['active', 'overdue']).limit(15),
      supabase.from('expenses').select('description, amount, category, date').eq('user_id', user_id).order('date', { ascending: false }).limit(10),
    ])

    const context = {
      active_projects: projectsR.data ?? [],
      recent_decisions: decisionsR.data ?? [],
      okrs: okrsR.data ?? [],
      key_stakeholders: stakeholdersR.data ?? [],
      active_tasks: tasksR.data ?? [],
      recent_expenses: expensesR.data ?? [],
    }

    // ── Run AI scenario analysis ────────────────────────────────────────────
    if (!ANTHROPIC_KEY) {
      await logExecution(user_id, AGENT_NAME, 'failed', tier, trigger_type, { error: 'No API key' }, Date.now() - started)
      return json({ status: 'ERROR', message: 'ANTHROPIC_API_KEY not configured' }, 500)
    }

    const systemPrompt = `You are the PIOS World Model Agent for a multi-domain executive (DBA researcher, FM consultant, SaaS founder).

Analyze their cross-domain context and provide scenario intelligence:
1. CROSS-DOMAIN CONFLICTS: Where priorities across domains collide (time, resources, attention)
2. RISK SCENARIOS: What could go wrong in the next 30 days based on current trajectory
3. OPPORTUNITY WINDOWS: Time-sensitive opportunities visible from cross-domain analysis
4. RESOURCE ALLOCATION: Where effort is misallocated vs. impact
5. STAKEHOLDER DYNAMICS: Relationship risks and opportunities
6. STRATEGIC RECOMMENDATION: One high-impact action for this week

Return JSON: {
  "conflicts": [{"domains": [string, string], "description": string, "severity": "high"|"medium"|"low"}],
  "risk_scenarios": [{"scenario": string, "probability": number, "impact": string, "mitigation": string}],
  "opportunities": [{"opportunity": string, "window": string, "domains": [string]}],
  "resource_misalignment": [{"area": string, "current_effort": string, "recommended": string}],
  "stakeholder_dynamics": [{"stakeholder": string, "risk_or_opportunity": string, "action": string}],
  "strategic_recommendation": string,
  "world_model_confidence": number,
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
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Cross-domain executive context:\n${JSON.stringify(context, null, 2).slice(0, 4000)}\n\nProvide your world model analysis as JSON.`,
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
