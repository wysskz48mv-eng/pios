import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/live/veritasedge
// Pulls live metrics from the VeritasEdge™ Supabase project.
// Uses the ACTUAL SE schema: organisations, projects, maintainable_assets, obe_runs, agent_recommendations
// PIOS v2.2 | VeritasIQ Technologies Ltd

export const runtime = 'nodejs'

const SE_URL = 'https://oxqqzxvuksgzeeyhufhp.supabase.co'
const SE_KEY = process.env.SUPABASE_SE_SERVICE_KEY ?? ''

export async function GET() {
  if (!SE_KEY) {
    return NextResponse.json({
      connected: false,
      error: 'SUPABASE_SE_SERVICE_KEY not configured',
      snapshot: null,
    })
  }

  try {
    const se = createClient(SE_URL, SE_KEY, { auth: { persistSession: false } })
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString()

    const [orgsR, projectsR, assetsR, obeRunsR, agentR, allocR] = await Promise.all([
      // SaaS tenants = organisations (not property tenants)
      se.from('organisations').select('id, name, plan, created_at', { count: 'exact', head: false }),
      se.from('projects').select('id, status, name', { count: 'exact', head: false }),
      se.from('maintainable_assets').select('id, status, replacement_cost_sar', { count: 'exact', head: false }),
      // OBE runs — most recent first
      se.from('obe_runs').select('id, created_at, total_budget_sar, status').order('created_at', { ascending: false }).limit(5),
      // Agent recommendations = agent activity log
      se.from('agent_recommendations').select('id, recommendation_type, created_at, status').order('created_at', { ascending: false }).limit(20),
      // Allocation configs — shows fairness engine activity
      se.from('allocation_configurations').select('id, jcv_status, status, created_at').order('created_at', { ascending: false }).limit(5),
    ])

    const orgs   = orgsR.data   ?? []
    const assets = assetsR.data ?? []
    const obeRuns= obeRunsR.data ?? []
    const agents = agentR.data  ?? []

    // Asset portfolio value
    const totalAssetValue = assets.reduce(
      (sum: number, a: any) => sum + (Number(a.replacement_cost_sar) || 0), 0
    )

    // OBE: most recent complete run
    const latestOBE = obeRuns.find((r: any) => r.status === 'complete') ?? obeRuns[0] ?? null

    // Agent activity breakdown
    const agentByType = agents.reduce((acc: Record<string, number>, r: any) => {
      const t = r.recommendation_type ?? 'unknown'
      acc[t] = (acc[t] || 0) + 1
      return acc
    }, {})

    const recentAgents = agents.filter((r: Record<string, unknown>) => r.created_at >= sevenDaysAgo).length

    // Plan breakdown
    const planBreakdown = orgs.reduce((acc: Record<string, number>, o: any) => {
      acc[o.plan ?? 'unknown'] = (acc[o.plan ?? 'unknown'] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      connected: true,
      snapshot: {
        tenants: {
          total: orgsR.count ?? 0,
          list:  orgs.slice(0, 5).map((o: Record<string, unknown>) => ({ name: o.name, plan: o.plan })),
          byPlan: planBreakdown,
        },
        projects: {
          total:  projectsR.count ?? 0,
          active: (projectsR.data ?? []).filter((p: Record<string, unknown>) => p.status === 'active').length,
          list:   (projectsR.data ?? []).slice(0, 3).map((p: Record<string, unknown>) => p.name),
        },
        assets: {
          total:        assetsR.count ?? 0,
          totalValueSAR: totalAssetValue,
          active:       assets.filter((a: Record<string, unknown>) => a.status === 'operational').length,
        },
        obe: latestOBE ? {
          lastRun:       latestOBE.created_at,
          totalBudgetSAR: latestOBE.total_budget_sar,
          status:        latestOBE.status,
        } : null,
        agents: {
          total:       agentR.count ?? agents.length,
          recentRuns:  recentAgents,
          byType:      agentByType,
        },
        allocations: {
          total:   allocR.count ?? 0,
          pending: (allocR.data ?? []).filter((a: Record<string, unknown>) => a.jcv_status === 'pending').length,
        },
        pulledAt: new Date().toISOString(),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ connected: false, error: err.message ?? 'Unknown error', snapshot: null })
  }
}
