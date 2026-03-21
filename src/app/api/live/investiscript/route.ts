import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/live/investiscript
// Pulls live metrics from the InvestiScript Supabase project.
// Uses the ACTUAL IS schema: Organisation, User, Topic, Script, UsageRecord
// PIOS v1.0 | Sustain International FZE Ltd

export const runtime = 'nodejs'

const IS_URL = 'https://dexsdwqkunnmhxcwayda.supabase.co'
const IS_KEY = process.env.SUPABASE_IS_SERVICE_KEY ?? ''

export async function GET() {
  if (!IS_KEY) {
    return NextResponse.json({
      connected: false,
      error: 'SUPABASE_IS_SERVICE_KEY not configured',
      snapshot: null,
    })
  }

  try {
    const is = createClient(IS_URL, IS_KEY, { auth: { persistSession: false } })
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
    const trialing       = orgs.filter((o: any) => o.planStatus === 'trialing').length
    const activeOrgs     = orgs.filter((o: any) => o.planStatus === 'active').length
    const expiredTrials  = orgs.filter((o: any) => {
      return o.planStatus === 'trialing' && o.trialEndsAt && new Date(o.trialEndsAt) <= now
    }).length
    const activeTrial    = orgs.filter((o: any) => {
      return o.planStatus === 'trialing' && o.trialEndsAt && new Date(o.trialEndsAt) > now
    }).length
    const planBreakdown  = orgs.reduce((acc: Record<string, number>, o: any) => {
      if (o.planStatus === 'active') acc[o.plan] = (acc[o.plan] || 0) + 1
      return acc
    }, {})

    // Recency
    const recentOrgs   = orgs.filter((o: any)   => o.createdAt > thirtyDaysAgo).length
    const recentUsers  = users.filter((u: any)  => u.createdAt > thirtyDaysAgo).length
    const recentTopics = topics.filter((t: any) => t.createdAt > sevenDaysAgo).length

    // Usage
    const totalInputTokens  = usage.reduce((s: number, r: any) => s + (Number(r.inputTokens)  || 0), 0)
    const totalOutputTokens = usage.reduce((s: number, r: any) => s + (Number(r.outputTokens) || 0), 0)
    const totalCostUsd      = usage.reduce((s: number, r: any) => s + (Number(r.costUsd)      || 0), 0)

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
  } catch (err: any) {
    return NextResponse.json({
      connected: false,
      error: err.message ?? 'Unknown error',
      snapshot: null,
    })
  }
}
