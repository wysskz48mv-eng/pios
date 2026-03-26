import { NextRequest, NextResponse } from 'next/server'
import { createClient as createExternalClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// GET /api/live/investiscript
// Pulls live metrics from the InvestiScript Supabase project.
// Uses the ACTUAL IS schema: Organisation, User, Topic, Script, UsageRecord
// PIOS v2.9 | VeritasIQ Technologies Ltd
// Security: requires authenticated PIOS session

export const runtime = 'nodejs'

const IS_URL = 'https://dexsdwqkunnmhxcwayda.supabase.co'
const IS_KEY = process.env.SUPABASE_IS_SERVICE_KEY ?? ''

export async function GET(_req: NextRequest) {
  // Auth guard — must be a signed-in PIOS user
  const supabase = createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!IS_KEY) {
    return NextResponse.json({
      connected: false,
      error: 'SUPABASE_IS_SERVICE_KEY not configured',
      snapshot: null,
    })
  }

  try {
    const is = createExternalClient(IS_URL, IS_KEY, { auth: { persistSession: false } })
    const now = new Date()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString()
    const sevenDaysAgo  = new Date(Date.now() -  7 * 86400_000).toISOString()

    const [orgsR, usersR, topicsR, scriptsR, usageR] = await Promise.all([
      // Organisations = IS tenants (each org is a newsroom)
      is.from('Organisation').select('id, name, plan, "planStatus", "trialEndsAt", "stripeCustomerId", "createdAt"', { count: 'exact', head: false }),
      // Users (across all orgs)
      is.from('User').select('id, "createdAt", role', { count: 'exact', head: false }),
      // Topics = investigations
      is.from('Topic').select('id, "createdAt", "organisationId"', { count: 'exact', head: false }),
      // Scripts = published/drafted articles
      is.from('Script').select('id, "createdAt"', { count: 'exact', head: false }),
      // UsageRecord = AI token consumption
      is.from('UsageRecord').select('"inputTokens", "outputTokens", "costUsd", "createdAt"').gte('"createdAt"', thirtyDaysAgo),
    ])

    const orgs   = orgsR.data   ?? []
    const users  = usersR.data  ?? []
    const topics = topicsR.data ?? []
    const usage  = usageR.data  ?? []

    // Org breakdowns
    const trialing       = orgs.filter((o: Record<string, unknown>) => (o as any)?.planStatus === 'trialing').length
    const activeOrgs     = orgs.filter((o: Record<string, unknown>) => (o as any)?.planStatus === 'active').length
    const expiredTrials  = orgs.filter((o: Record<string, unknown>) => {
      return (o as any)?.planStatus === 'trialing' && (o as any)?.trialEndsAt && new Date((o as any)?.trialEndsAt) <= now
    }).length
    const activeTrial    = orgs.filter((o: Record<string, unknown>) => {
      return (o as any)?.planStatus === 'trialing' && (o as any)?.trialEndsAt && new Date((o as any)?.trialEndsAt) > now
    }).length
    const planBreakdown  = orgs.reduce((acc: Record<string, number>, o: unknown) => {
      if ((o as any).planStatus === 'active') acc[(o as any).plan] = (acc[(o as any).plan] || 0) + 1
      return acc
    }, {})

    // Recency
    const recentOrgs   = orgs.filter((o: Record<string, unknown>) => (o as any).createdAt > thirtyDaysAgo).length
    const recentUsers  = users.filter((u: Record<string, unknown>) => (u as any).createdAt > thirtyDaysAgo).length
    const recentTopics = topics.filter((t: Record<string, unknown>) => (t as any).createdAt > sevenDaysAgo).length

    // Usage
    const totalInputTokens  = usage.reduce((s: number, r: unknown) => s + (Number((r as any).inputTokens)  || 0), 0)
    const totalOutputTokens = usage.reduce((s: number, r: unknown) => s + (Number((r as any).outputTokens) || 0), 0)
    const totalCostUsd      = usage.reduce((s: number, r: unknown) => s + (Number((r as any).costUsd)      || 0), 0)

    return NextResponse.json({
      connected: true,
      snapshot: {
        users: {
          total:         usersR.count  ?? 0,
          activeTrial,
          expiredTrial:  expiredTrials,
          recentSignups: recentUsers,
        },
        organisations: {
          total:    orgsR.count ?? 0,
          trialing,
          active:   activeOrgs,
          recentNew: recentOrgs,
          byPlan:   planBreakdown,
        },
        investigations: {
          total:       topicsR.count ?? 0,
          recentWeek:  recentTopics,
        },
        scripts: {
          total: scriptsR.count ?? 0,
        },
        apiUsage: {
          inputTokens:   totalInputTokens,
          outputTokens:  totalOutputTokens,
          totalTokens:   totalInputTokens + totalOutputTokens,
          costUsd:       Math.round(totalCostUsd * 100) / 100,
          period:        'last 30 days',
        },
        pulledAt: now.toISOString(),
      },
    })
  } catch (err: unknown) {
    return NextResponse.json({
      connected: false,
      error: (err as Error).message ?? 'Unknown error',
      snapshot: null,
    })
  }
}
