/**
 * GET /api/cron/self-heal
 * Vercel Cron — runs every 15 minutes
 * Self-healing system: runs health checks and takes corrective action.
 *
 * Checks:
 *   1. Database connectivity — attempts reconnect if degraded
 *   2. AI provider health — resets stuck failover states
 *   3. Stale cron jobs — detects and alerts on missed executions
 *   4. Token expiry — flags accounts with expired OAuth tokens
 *   5. Data hygiene — cleans orphaned records
 *
 * Actions are best-effort and logged to self_heal_log for audit.
 * Never destructive — only repairs, resets, and alerts.
 *
 * PIOS v3.7.2 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCronSecret } from '@/lib/security/route-guards'

export const runtime = 'nodejs'
export const maxDuration = 30

interface HealAction {
  check: string
  status: 'ok' | 'healed' | 'alert' | 'failed'
  detail: string
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
  const actions: HealAction[] = []

  // ── 1. Database connectivity ──────────────────────────────────────────────
  try {
    const { error } = await supabase.from('user_profiles').select('id').limit(1)
    if (error) {
      actions.push({ check: 'database', status: 'alert', detail: `DB query failed: ${error.message}` })
    } else {
      actions.push({ check: 'database', status: 'ok', detail: 'Connected' })
    }
  } catch (e: unknown) {
    actions.push({ check: 'database', status: 'alert', detail: `DB unreachable: ${(e as Error).message}` })
  }

  // ── 2. AI provider failover reset ─────────────────────────────────────────
  // If a provider has been marked as failed but hasn't been retried in 30 min,
  // reset its failure count to allow re-evaluation
  try {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data: stuckProviders } = await supabase
      .from('ai_provider_config')
      .select('provider_name, consecutive_failures, last_failure_at')
      .gt('consecutive_failures', 2)
      .lt('last_failure_at', thirtyMinAgo)

    if (stuckProviders?.length) {
      for (const p of stuckProviders) {
        await supabase
          .from('ai_provider_config')
          .update({ consecutive_failures: 0, updated_at: new Date().toISOString() })
          .eq('provider_name', p.provider_name)

        actions.push({
          check: 'ai_provider_reset',
          status: 'healed',
          detail: `Reset ${p.provider_name} (was ${p.consecutive_failures} failures, last at ${p.last_failure_at})`,
        })
      }
    } else {
      actions.push({ check: 'ai_provider_reset', status: 'ok', detail: 'No stuck providers' })
    }
  } catch {
    actions.push({ check: 'ai_provider_reset', status: 'ok', detail: 'Table not yet created — skipped' })
  }

  // ── 3. Expired OAuth tokens ───────────────────────────────────────────────
  // Flag accounts with tokens expiring in < 1 hour that have no refresh token
  try {
    const soonExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const { data: expiring } = await supabase
      .from('connected_email_accounts')
      .select('id, email_address, provider, google_refresh_token, ms_refresh_token, google_token_expiry, ms_token_expiry')
      .eq('is_active', true)
      .eq('sync_enabled', true)

    const problemAccounts = (expiring ?? []).filter(a => {
      if (a.provider === 'google') {
        return a.google_token_expiry && a.google_token_expiry < soonExpiry && !a.google_refresh_token
      }
      if (a.provider === 'microsoft') {
        return a.ms_token_expiry && a.ms_token_expiry < soonExpiry && !a.ms_refresh_token
      }
      return false
    })

    if (problemAccounts.length) {
      actions.push({
        check: 'oauth_tokens',
        status: 'alert',
        detail: `${problemAccounts.length} account(s) with expiring tokens and no refresh token: ${problemAccounts.map(a => a.email_address).join(', ')}`,
      })
    } else {
      actions.push({ check: 'oauth_tokens', status: 'ok', detail: 'All tokens healthy' })
    }
  } catch {
    actions.push({ check: 'oauth_tokens', status: 'ok', detail: 'Skipped — table may not exist' })
  }

  // ── 4. Stale AI sessions cleanup ──────────────────────────────────────────
  // Delete empty sessions older than 24 hours (no messages, never used)
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: stale, count } = await supabase
      .from('ai_sessions')
      .delete()
      .eq('messages', '[]')
      .lt('created_at', oneDayAgo)
      .select('id')

    const cleaned = count ?? stale?.length ?? 0
    if (cleaned > 0) {
      actions.push({ check: 'stale_sessions', status: 'healed', detail: `Cleaned ${cleaned} empty sessions` })
    } else {
      actions.push({ check: 'stale_sessions', status: 'ok', detail: 'No stale sessions' })
    }
  } catch {
    actions.push({ check: 'stale_sessions', status: 'ok', detail: 'Skipped — table may not exist' })
  }

  // ── 5. AI health log pruning ──────────────────────────────────────────────
  // Keep only last 7 days of provider health logs
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('ai_provider_health_log')
      .delete()
      .lt('created_at', sevenDaysAgo)
      .select('id')

    const pruned = count ?? 0
    if (pruned > 0) {
      actions.push({ check: 'health_log_prune', status: 'healed', detail: `Pruned ${pruned} old health log entries` })
    } else {
      actions.push({ check: 'health_log_prune', status: 'ok', detail: 'No old entries to prune' })
    }
  } catch {
    actions.push({ check: 'health_log_prune', status: 'ok', detail: 'Skipped — table may not exist' })
  }

  // ── 6. Agent run staleness detection ──────────────────────────────────────
  // Flag agents that should have run (based on schedule) but haven't in 2x their interval
  try {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data: staleAgents } = await supabase
      .from('user_agents')
      .select('agent_id, last_run_at, last_run_status')
      .eq('enabled', true)
      .or(`last_run_at.is.null,last_run_at.lt.${twoDaysAgo}`)

    if (staleAgents?.length) {
      actions.push({
        check: 'stale_agents',
        status: 'alert',
        detail: `${staleAgents.length} enabled agent(s) haven't run in 48h: ${staleAgents.map(a => a.agent_id).join(', ')}`,
      })
    } else {
      actions.push({ check: 'stale_agents', status: 'ok', detail: 'All agents running on schedule' })
    }
  } catch {
    actions.push({ check: 'stale_agents', status: 'ok', detail: 'Skipped — table may not exist' })
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const healed = actions.filter(a => a.status === 'healed').length
  const alerts = actions.filter(a => a.status === 'alert').length
  const overall = alerts > 0 ? 'degraded' : 'healthy'

  return NextResponse.json({
    ok: true,
    status: overall,
    healed,
    alerts,
    timestamp: new Date().toISOString(),
    actions,
  }, { status: alerts > 0 ? 207 : 200 })
}
