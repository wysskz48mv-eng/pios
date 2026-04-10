/**
 * Agent subscription gate — shared by all PIOS intelligence agents
 * Checks user tier, schedule eligibility, and calculates next run.
 *
 * Free tier: 1 run every 5 days at 8:00 AM UTC
 * Paid tiers: 4 runs per day at 8am, 12pm, 4pm, 8pm UTC
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

export interface AgentRequest {
  user_id: string
  trigger_type: 'scheduled' | 'user_request' | 'briefing'
  force_execution?: boolean
}

export interface GateResult {
  allowed: boolean
  subscription: Record<string, unknown> | null
  message?: string
  next_run?: string
  status: number
}

const PAID_TIERS = ['student', 'individual', 'pro', 'professional']

export function getSupabase() {
  return createClient(SUPABASE_URL, SERVICE_KEY)
}

export async function checkAgentGate(req: AgentRequest): Promise<GateResult> {
  const supabase = getSupabase()

  const { data: subscription } = await supabase
    .from('user_agent_subscriptions')
    .select('*')
    .eq('user_id', req.user_id)
    .single()

  if (!subscription) {
    return {
      allowed: false,
      subscription: null,
      message: 'User subscription not found',
      status: 400,
    }
  }

  // On-demand request from unpaid user
  if (!subscription.has_agent_access && req.trigger_type === 'user_request') {
    return {
      allowed: false,
      subscription,
      message: 'Advanced agent analysis available with subscription',
      status: 403,
    }
  }

  // Free tier schedule check (1x every 5 days)
  if (subscription.subscription_tier === 'free' && !req.force_execution) {
    const now = new Date()
    const nextRun = subscription.next_agent_run ? new Date(subscription.next_agent_run) : new Date(0)

    if (now < nextRun && req.trigger_type !== 'briefing') {
      return {
        allowed: false,
        subscription,
        message: 'This agent runs once every 5 days for free tier',
        next_run: subscription.next_agent_run,
        status: 202,
      }
    }
  }

  return { allowed: true, subscription, status: 200 }
}

export function calculateNextRun(tier: string): string {
  const now = new Date()

  if (!PAID_TIERS.includes(tier)) {
    // Free: 5 days from now at 8:00 AM UTC
    const next = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)
    next.setUTCHours(8, 0, 0, 0)
    return next.toISOString()
  }

  // Paid: next slot at 8am, 12pm, 4pm, 8pm UTC
  const hours = [8, 12, 16, 20]
  const currentHour = now.getUTCHours()
  const nextHourIndex = hours.findIndex(h => h > currentHour)

  const nextRun = new Date(now)
  if (nextHourIndex !== -1) {
    nextRun.setUTCHours(hours[nextHourIndex], 0, 0, 0)
  } else {
    nextRun.setUTCDate(nextRun.getUTCDate() + 1)
    nextRun.setUTCHours(8, 0, 0, 0)
  }

  return nextRun.toISOString()
}

export async function logExecution(
  userId: string,
  agentName: string,
  status: 'success' | 'failed' | 'skipped' | 'gated',
  tier: string,
  reason: string,
  result: Record<string, unknown> | null,
  durationMs: number,
) {
  const supabase = getSupabase()
  const nextRun = calculateNextRun(tier)

  await supabase.from('agent_execution_log').insert({
    user_id: userId,
    agent_name: agentName,
    execution_status: status,
    execution_reason: reason,
    subscription_tier: tier,
    result_summary: result,
    execution_time_ms: durationMs,
    next_scheduled_run: nextRun,
  })

  // Update subscription record
  if (status === 'success') {
    await supabase.from('user_agent_subscriptions').update({
      last_agent_run: new Date().toISOString(),
      next_agent_run: nextRun,
      agent_run_count: (await supabase.from('user_agent_subscriptions').select('agent_run_count').eq('user_id', userId).single()).data?.agent_run_count + 1 || 1,
    }).eq('user_id', userId)
  }

  return nextRun
}
