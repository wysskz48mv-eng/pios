import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/live/investiscript
// Pulls live metrics from the InvestiScript Supabase project

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

    const [usersR, subsR, invR, articlesR, apiUsageR] = await Promise.all([
      is.from('users').select('id, plan, trial_ends_at, created_at', { count: 'exact', head: false }),
      is.from('subscriptions').select('id, status, plan', { count: 'exact', head: false }),
      is.from('investigations').select('id, status, created_at', { count: 'exact', head: false }),
      is.from('articles').select('id, created_at', { count: 'exact', head: false }),
      is.from('api_usage').select('endpoint, tokens_used, created_at').order('created_at', { ascending: false }).limit(50),
    ])

    const users = usersR.data ?? []
    const subs = subsR.data ?? []
    const now = new Date()

    const trialUsers = users.filter((u: any) => u.plan === 'trial' && u.trial_ends_at && new Date(u.trial_ends_at) > now).length
    const expiredTrials = users.filter((u: any) => u.plan === 'trial' && u.trial_ends_at && new Date(u.trial_ends_at) <= now).length
    const activeSubscriptions = subs.filter((s: any) => s.status === 'active').length
    const planBreakdown = subs.reduce((acc: Record<string, number>, s: any) => {
      if (s.status === 'active') acc[s.plan] = (acc[s.plan] || 0) + 1; return acc
    }, {})

    const totalTokens = (apiUsageR.data ?? []).reduce((sum: number, r: any) => sum + (Number(r.tokens_used) || 0), 0)

    // Signups in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
    const recentSignups = users.filter((u: any) => u.created_at > thirtyDaysAgo).length

    return NextResponse.json({
      connected: true,
      snapshot: {
        users: {
          total: usersR.count ?? 0,
          activeTrial: trialUsers,
          expiredTrial: expiredTrials,
          recentSignups,
        },
        subscriptions: {
          total: activeSubscriptions,
          byPlan: planBreakdown,
        },
        investigations: { total: invR.count ?? 0 },
        articles: { total: articlesR.count ?? 0 },
        apiUsage: { recentTokens: totalTokens },
        pulledAt: new Date().toISOString(),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ connected: false, error: err.message ?? 'Unknown error', snapshot: null })
  }
}
