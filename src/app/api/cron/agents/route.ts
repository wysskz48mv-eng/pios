import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCronSecret } from '@/lib/security/route-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type AgentRow = {
  user_id: string
  agent_id: string
  enabled: boolean
}

async function runAgentCycle(supabase: any, row: AgentRow): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)

  if (row.agent_id === 'task_escalator') {
    const { count } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', row.user_id)
      .in('status', ['todo', 'in_progress'])
      .lt('due_date', today)
    return `Task escalator checked. Overdue tasks: ${count ?? 0}.`
  }

  if (row.agent_id === 'dba_deadline') {
    const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
    const { count } = await supabase
      .from('academic_modules')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', row.user_id)
      .not('status', 'in', '("passed","failed")')
      .gte('deadline', today)
      .lte('deadline', in14)
    return `DBA deadline monitor checked. Deadlines in next 14 days: ${count ?? 0}.`
  }

  if (row.agent_id === 'ip_monitor') {
    const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)
    const { count } = await supabase
      .from('ip_assets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', row.user_id)
      .eq('status', 'active')
      .gte('renewal_date', today)
      .lte('renewal_date', in90)
    return `IP monitor checked. Renewals due in 90 days: ${count ?? 0}.`
  }

  if (row.agent_id === 'market_intelligence') {
    const { count } = await supabase
      .from('market_intelligence')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', row.user_id)
      .eq('date', today)
    return `Market intelligence checked. Entries generated today: ${count ?? 0}.`
  }

  if (row.agent_id === 'literature_scanner') {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const { count } = await supabase
      .from('paper_calls')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', row.user_id)
      .gte('created_at', `${weekAgo}T00:00:00Z`)
    return `Literature scanner checked. New calls/papers in 7 days: ${count ?? 0}.`
  }

  if (row.agent_id === 'platform_health') {
    return 'Platform health heartbeat completed from cron scheduler.'
  }

  return 'Agent heartbeat completed.'
}

export async function GET(req: NextRequest) {
  const blocked = requireCronSecret(req)
  if (blocked) return blocked

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
  }

  const supabase = createClient(url, key)

  const { data: agents, error } = await supabase
    .from('user_agents')
    .select('user_id,agent_id,enabled')
    .eq('enabled', true)

  if (error) {
    return NextResponse.json({ error: `Failed to read user_agents: ${error.message}` }, { status: 500 })
  }

  const rows = (agents ?? []) as AgentRow[]
  const startedAt = Date.now()
  let success = 0
  let failed = 0
  const details: Array<{ user_id: string; agent_id: string; status: 'success' | 'failed'; detail: string }> = []

  for (const row of rows) {
    const runStart = Date.now()
    try {
      const output = await runAgentCycle(supabase, row)
      await supabase.from('user_agents').update({
        last_run_at: new Date().toISOString(),
        last_run_status: 'success',
        last_run_output: output,
        last_run_ms: Date.now() - runStart,
        updated_at: new Date().toISOString(),
      }).eq('user_id', row.user_id).eq('agent_id', row.agent_id)

      success++
      details.push({ user_id: row.user_id, agent_id: row.agent_id, status: 'success', detail: output })
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : 'unknown error'
      await supabase.from('user_agents').update({
        last_run_at: new Date().toISOString(),
        last_run_status: 'failed',
        last_run_output: message,
        last_run_ms: Date.now() - runStart,
        updated_at: new Date().toISOString(),
      }).eq('user_id', row.user_id).eq('agent_id', row.agent_id)

      failed++
      details.push({ user_id: row.user_id, agent_id: row.agent_id, status: 'failed', detail: message })
    }
  }

  return NextResponse.json({
    ok: true,
    checked: rows.length,
    success,
    failed,
    elapsed_ms: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
    details,
  }, { status: failed > 0 ? 207 : 200 })
}
