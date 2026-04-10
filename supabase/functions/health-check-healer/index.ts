// HealthCheckHealer — Autonomous Self-Healing Agent
// Level 2: Auto-Healing (Executable)
// Auto-detects & auto-fixes database connection issues, stale state, RLS blocks
// Triggers Vercel rebuild if database is unresponsive
//
// PIOS v3.7.2 | VeritasIQ Technologies Ltd

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const runId = crypto.randomUUID()
  const actions: string[] = []
  let overallStatus = 'HEALTHY'

  // ── 1. Database connectivity + latency ────────────────────────────────────
  let dbHealthy = false
  let responseTime = -1

  try {
    const t0 = Date.now()
    const { error } = await supabase.from('user_profiles').select('id').limit(1)
    responseTime = Date.now() - t0
    dbHealthy = !error && responseTime < 3000
  } catch {
    dbHealthy = false
    responseTime = -1
  }

  if (dbHealthy && responseTime < 1000) {
    actions.push(`Database healthy (${responseTime}ms)`)
  } else if (dbHealthy && responseTime >= 1000) {
    actions.push(`Database slow (${responseTime}ms) — monitoring`)
    overallStatus = 'DEGRADED'
  } else {
    overallStatus = 'UNHEALTHY'
    actions.push(`Database unreachable or error (${responseTime}ms)`)

    // AUTO-ACTION: Trigger Vercel rebuild to get fresh connections
    try {
      await triggerVercelRebuild()
      actions.push('Vercel rebuild triggered (auto-heal)')
    } catch (e) {
      actions.push(`Rebuild failed: ${(e as Error).message}`)
    }

    // Wait and recheck
    await new Promise(r => setTimeout(r, 5000))
    try {
      const t0 = Date.now()
      const { error } = await supabase.from('user_profiles').select('id').limit(1)
      responseTime = Date.now() - t0
      dbHealthy = !error
      if (dbHealthy) {
        overallStatus = 'RECOVERED'
        actions.push(`Database recovered after rebuild (${responseTime}ms)`)
      } else {
        actions.push('Database still unhealthy after rebuild — escalating')
      }
    } catch {
      actions.push('Recheck failed — database still down')
    }
  }

  // ── 2. Reset stuck AI provider failover ───────────────────────────────────
  try {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data: stuck } = await supabase
      .from('ai_provider_config')
      .select('provider_name, consecutive_failures')
      .gt('consecutive_failures', 2)
      .lt('last_failure_at', thirtyMinAgo)

    for (const p of stuck ?? []) {
      await supabase.from('ai_provider_config').update({
        consecutive_failures: 0,
        updated_at: new Date().toISOString(),
      }).eq('provider_name', p.provider_name)
      actions.push(`Reset AI provider: ${p.provider_name} (was ${p.consecutive_failures} failures)`)
    }
    if (!stuck?.length) actions.push('AI providers: all healthy')
  } catch {
    actions.push('AI provider check skipped (table may not exist)')
  }

  // ── 3. Auto-fix RLS tenant_id blocks from diagnostic findings ─────────────
  try {
    const { data: rlsFindings } = await supabase
      .from('pios_diagnostics')
      .select('id, affected_table, recurrence_count')
      .eq('check_type', 'rls_validation')
      .in('status', ['open', 'recurring'])
      .limit(10)

    for (const f of rlsFindings ?? []) {
      if (!f.affected_table) continue
      try {
        // Safe fix: drop tenant policy, create user_id policy
        const { error } = await supabase.rpc('exec_sql', {
          sql_query: `
            DO $$ BEGIN
              EXECUTE format('DROP POLICY IF EXISTS "tenant_rls_%s" ON public.%s', '${f.affected_table}', '${f.affected_table}');
              IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.${f.affected_table}'::regclass AND polname = 'user_rls_${f.affected_table}') THEN
                EXECUTE format('CREATE POLICY "user_rls_%s" ON public.%s FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', '${f.affected_table}', '${f.affected_table}');
              END IF;
            END $$;
          `,
        })

        if (!error) {
          await supabase.from('pios_diagnostics').update({
            status: 'auto_fixed',
            fix_applied: `Replaced tenant_id RLS with user_id RLS`,
            resolved_at: new Date().toISOString(),
          }).eq('id', f.id)
          actions.push(`Auto-fixed RLS: ${f.affected_table} (seen ${f.recurrence_count}x)`)
        }
      } catch {
        actions.push(`RLS fix failed for ${f.affected_table}`)
      }
    }
    if (!rlsFindings?.length) actions.push('RLS: no open findings')
  } catch {
    actions.push('RLS check skipped (diagnostics table may not exist)')
  }

  // ── 4. Clean stale data ───────────────────────────────────────────────────
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: stale } = await supabase
      .from('ai_sessions')
      .delete()
      .eq('messages', '[]')
      .lt('created_at', oneDayAgo)
      .select('id')

    if (stale?.length) {
      actions.push(`Cleaned ${stale.length} empty AI sessions`)
    }
  } catch {}

  // ── 5. Prune old health logs ──────────────────────────────────────────────
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: pruned } = await supabase
      .from('ai_provider_health_log')
      .delete()
      .lt('created_at', sevenDaysAgo)
      .select('id')

    if (pruned?.length) {
      actions.push(`Pruned ${pruned.length} old health log entries`)
    }
  } catch {}

  // ── Log run ───────────────────────────────────────────────────────────────
  await supabase.from('pios_diagnostic_runs').insert({
    id: runId,
    trigger: 'edge_function',
    completed_at: new Date().toISOString(),
    total_checks: actions.length,
    findings: overallStatus !== 'HEALTHY' ? 1 : 0,
    critical: overallStatus === 'UNHEALTHY' ? 1 : 0,
    high: 0,
    auto_fixed: actions.filter(a => a.includes('Auto-fixed') || a.includes('auto-heal') || a.includes('Reset') || a.includes('Cleaned')).length,
    status: 'completed',
  })

  // Slack alert if unhealthy
  if (overallStatus === 'UNHEALTHY' || overallStatus === 'DEGRADED') {
    await notifySlack({
      title: overallStatus === 'RECOVERED'
        ? 'Database Issue Auto-Healed'
        : 'Database Health Issue Detected',
      status: overallStatus,
      actions,
      responseTime,
    })
  }

  return new Response(JSON.stringify({
    status: overallStatus,
    agent: 'health-check-healer',
    responseTime,
    actions,
    autoHealed: overallStatus === 'RECOVERED',
    timestamp: new Date().toISOString(),
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

// ── Helpers ─────────────────────────────────────────────────────────────────

async function triggerVercelRebuild() {
  const vercelToken = Deno.env.get('VERCEL_TOKEN')
  const projectId = Deno.env.get('VERCEL_PROJECT_ID')
  if (!vercelToken || !projectId) {
    throw new Error('Missing VERCEL_TOKEN or VERCEL_PROJECT_ID')
  }
  const res = await fetch(`https://api.vercel.com/v13/deployments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${vercelToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'pios',
      project: projectId,
      target: 'production',
    }),
  })
  if (!res.ok) {
    throw new Error(`Vercel rebuild failed: ${res.status}`)
  }
}

async function notifySlack(message: Record<string, unknown>) {
  const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL')
  if (!webhookUrl) {
    console.log('[HealthCheckHealer]', JSON.stringify(message))
    return
  }
  try {
    const emoji = message.status === 'RECOVERED' ? '🩹' : '🚨'
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${emoji} *PIOS HealthCheckHealer*\n${message.title}\nStatus: ${message.status}\nResponse: ${message.responseTime}ms\nActions: ${(message.actions as string[])?.join('\n• ')}`,
      }),
    })
  } catch {}
}
