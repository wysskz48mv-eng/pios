/**
 * GET  /api/agents              — list registered agents + last run status
 * POST /api/agents              — register or toggle agent
 * POST /api/agents?action=run   — manually trigger agent run
 * POST /api/agents?action=configure — update agent config
 *
 * Background agents are autonomous PIOS routines that monitor, alert,
 * and act without manual triggering.
 *
 * PIOS™ v3.4.0 | Sprint I — Background Agents | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import Anthropic                     from '@anthropic-ai/sdk'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60
const anthropic = new Anthropic()
type R = Record<string, unknown>

// ── Agent catalogue ───────────────────────────────────────────────────────────
const AGENT_CATALOGUE = [
  {
    id:          'ip_monitor',
    name:        'IP Trademark Monitor',
    description: 'Watches IPO (UK), EUIPO, WIPO for trademark conflicts with VeritasIQ, VeritasEdge™, InvestiScript™, PIOS™',
    category:    'legal',
    icon:        '⚖',
    schedule:    'Weekly — Mon 08:00 UTC',
    default_on:  true,
    actions:     ['scan_conflicts', 'alert_renewal', 'generate_watch_report'],
  },
  {
    id:          'dba_deadline',
    name:        'DBA Deadline Monitor',
    description: 'Tracks Portsmouth CEGD submission deadlines, viva prep milestones, supervisor meeting cadence',
    category:    'academic',
    icon:        '🎓',
    schedule:    'Daily — 07:00 UTC',
    default_on:  true,
    actions:     ['check_milestones', 'alert_approaching', 'generate_prep_brief'],
  },
  {
    id:          'task_escalator',
    name:        'Task Escalator',
    description: 'Identifies overdue or stalled tasks and auto-inserts them into the Chief of Staff morning brief',
    category:    'executive',
    icon:        '⚡',
    schedule:    'Daily — 06:30 UTC',
    default_on:  true,
    actions:     ['scan_overdue', 'prioritise', 'insert_cos_brief'],
  },
  {
    id:          'literature_scanner',
    name:        'Literature Scanner',
    description: 'Monitors arXiv, SSRN, Google Scholar for new papers matching DBA research themes (FM, AI, GCC)',
    category:    'academic',
    icon:        '📚',
    schedule:    'Weekly — Sun 06:00 UTC',
    default_on:  false,
    actions:     ['scan_new_papers', 'assess_relevance', 'add_to_literature_hub'],
  },
  {
    id:          'platform_health',
    name:        'Platform Health Monitor',
    description: 'Monitors Vercel, Supabase, Stripe for errors, latency spikes, billing issues across all three platforms',
    category:    'technical',
    icon:        '🔧',
    schedule:    'Hourly',
    default_on:  true,
    actions:     ['check_uptime', 'check_billing', 'check_env_vars'],
  },
  {
    id:          'market_intelligence',
    name:        'Market Intelligence',
    description: 'Monitors GCC FM market news, MOMRA/REGA regulatory updates, Qiddiya/KSP project news',
    category:    'professional',
    icon:        '📊',
    schedule:    'Daily — 08:30 UTC',
    default_on:  false,
    actions:     ['scan_regulatory', 'scan_project_news', 'summarise_brief'],
  },
]

// ── GET — list agents + run status ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userAgents } = await supabase
      .from('user_agents')
      .select('agent_id,enabled,config,last_run_at,last_run_status,last_run_output')
      .eq('user_id', user.id)

    const agentMap = Object.fromEntries((userAgents ?? []).map((a: R) => [a.agent_id, a]))

    const agents = AGENT_CATALOGUE.map(a => ({
      ...a,
      enabled:         agentMap[a.id]?.enabled ?? a.default_on,
      config:          agentMap[a.id]?.config ?? {},
      last_run_at:     agentMap[a.id]?.last_run_at ?? null,
      last_run_status: agentMap[a.id]?.last_run_status ?? 'never_run',
      last_run_output: agentMap[a.id]?.last_run_output ?? null,
    }))

    return NextResponse.json({ ok: true, agents, catalogue: AGENT_CATALOGUE })
  } catch (err: any) {
    console.error('[PIOS agents GET]', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}

// ── POST — toggle / run / configure ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') ?? 'toggle'
    const body: R = await req.json()

    if (action === 'toggle') {
      const { agent_id, enabled } = body as any
      const agentDef = AGENT_CATALOGUE.find(a => a.id === agent_id)
      if (!agentDef) return NextResponse.json({ error: `Unknown agent: ${agent_id}` }, { status: 400 })

      await supabase.from('user_agents').upsert({
        user_id: user.id, agent_id,
        enabled: Boolean(enabled),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,agent_id' })

      return NextResponse.json({ ok: true, agent_id, enabled: Boolean(enabled) })
    }

    if (action === 'run') {
      const { agent_id } = body as any
      const agentDef = AGENT_CATALOGUE.find(a => a.id === agent_id)
      if (!agentDef) return NextResponse.json({ error: `Unknown agent: ${agent_id}` }, { status: 400 })

      const started = Date.now()

      // Fetch relevant PIOS data for the agent
      const contextData = await buildAgentContext(supabase, user.id, agent_id)

      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 800,
        messages: [{ role: 'user', content:
          `You are the PIOS ${agentDef.name} background agent.\n\n` +
          `Agent description: ${agentDef.description}\n` +
          `Actions: ${agentDef.actions.join(', ')}\n` +
          `Context data:\n${JSON.stringify(contextData, null, 2).slice(0, 2000)}\n\n` +
          `Run a complete agent cycle. For each action, provide findings and any recommended PIOS actions.\n` +
          `Format your output clearly with action headings. Be specific and actionable.\n` +
          `End with: AGENT SUMMARY — 2 sentences on the overall status and top recommended action.`
        }],
      })

      const output = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
      const duration = Date.now() - started

      // Log the run
      await supabase.from('user_agents').upsert({
        user_id: user.id, agent_id,
        last_run_at:     new Date().toISOString(),
        last_run_status: 'success',
        last_run_output: output,
        last_run_ms:     duration,
        updated_at:      new Date().toISOString(),
      }, { onConflict: 'user_id,agent_id' })

      return NextResponse.json({ ok: true, action: 'run', agent_id, output, duration_ms: duration })
    }

    if (action === 'configure') {
      const { agent_id, config } = body as any
      await supabase.from('user_agents').upsert({
        user_id: user.id, agent_id,
        config: config ?? {},
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,agent_id' })
      return NextResponse.json({ ok: true, action: 'configure', agent_id })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err: any) {
    console.error('[PIOS agents POST]', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}

// ── Build agent context from PIOS data ────────────────────────────────────────
async function buildAgentContext(supabase: any, userId: string, agentId: string): Promise<R> {
  const ctx: R = { agent_id: agentId, run_date: new Date().toISOString().slice(0, 10) }

  if (agentId === 'ip_monitor') {
    const { data: ipAssets } = await supabase.from('ip_assets').select('name,asset_type,status,renewal_date,jurisdiction').eq('user_id', userId)
    ctx.ip_assets = ipAssets ?? []
    ctx.trademarks = ['VeritasIQ', 'VeritasEdge™', 'InvestiScript™', 'PIOS™', 'NemoClaw™']
    ctx.trademark_status = 'IPO UK filings submitted (£340 each) — VeritasEdge™ + VeritasIQ pending. InvestiScript™ + PIOS™ planned Q2.'
  }

  if (agentId === 'dba_deadline') {
    const { data: chapters } = await supabase.from('thesis_chapters').select('chapter_num,title,status,word_count,target_words').eq('user_id', userId)
    ctx.chapters = chapters ?? []
    ctx.programme = 'Portsmouth DBA — CEGD — Supervisors: Ozlem Bak + Raja Sreedharan'
    ctx.key_deadlines = ['Qiddiya RFP 14 Apr 2026', 'Consortium meeting ~1 Apr 2026']
  }

  if (agentId === 'task_escalator') {
    const { data: tasks } = await supabase.from('tasks').select('title,priority,status,due_date').eq('user_id', userId)
      .in('status', ['todo','in_progress']).order('due_date', { ascending: true }).limit(20)
    const overdue = (tasks ?? []).filter((t: R) => t.due_date && String(t.due_date) < new Date().toISOString())
    ctx.tasks = tasks ?? []
    ctx.overdue_tasks = overdue
    ctx.overdue_count = overdue.length
  }

  if (agentId === 'platform_health') {
    ctx.platforms = [
      { name: 'VeritasEdge™',   head: 'a2c7f6e', url: 'sustainedge.vercel.app',             pending: ['M044-M053+M055 migrations', 'Supabase Pro'] },
      { name: 'InvestiScript™', head: 'cd1b24d', url: 'investiscript.vercel.app',            pending: ['NEXT_PUBLIC_SUPABASE_URL env var', 'SUPABASE_SERVICE_ROLE_KEY env var', 'DATABASE_URL env var', 'RESEND_API_KEY', 'CRON_SECRET', 'Stripe live keys'] },
      { name: 'PIOS™',          head: '9f1f1e2',  url: 'pios-wysskz48mv-engs-projects.vercel.app', pending: ['CRON_SECRET', 'Gmail OAuth'] },
    ]
    ctx.pat_expiry = '16 May 2026 — rotate before 9 May'
  }

  if (agentId === 'market_intelligence') {
    ctx.watch_topics = ['MOMRA 2024 compliance', 'Qiddiya Project updates', 'GCC FM market', 'REGA regulatory', 'Saudi Vision 2030 FM']
  }

  return ctx
}
