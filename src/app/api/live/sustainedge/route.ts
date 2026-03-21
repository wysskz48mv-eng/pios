import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/live/sustainedge
// Pulls live metrics from the SustainEdge Supabase project
// Uses service role key stored as SUPABASE_SE_SERVICE_KEY env var

export const runtime = 'nodejs'

const SE_URL = 'https://oxqqzxvuksgzeeyhufhp.supabase.co'
const SE_KEY = process.env.SUPABASE_SE_SERVICE_KEY ?? ''

export async function GET() {
  // Graceful degradation if env var not set
  if (!SE_KEY) {
    return NextResponse.json({
      connected: false,
      error: 'SUPABASE_SE_SERVICE_KEY not configured',
      snapshot: null,
    })
  }

  try {
    const se = createClient(SE_URL, SE_KEY, { auth: { persistSession: false } })

    const [tenantsR, projectsR, assetsR, obeRunsR, agentLogsR] = await Promise.all([
      se.from('tenants').select('id, name, plan, created_at', { count: 'exact', head: false }),
      se.from('projects').select('id, status', { count: 'exact', head: false }),
      se.from('assets').select('id, status, asset_value_sar', { count: 'exact', head: false }),
      se.from('obe_runs').select('id, created_at, total_budget_sar, _engine').order('created_at', { ascending: false }).limit(5),
      se.from('agent_logs').select('id, agent_type, created_at, status').order('created_at', { ascending: false }).limit(10),
    ])

    const assets = assetsR.data ?? []
    const totalAssetValue = assets.reduce((sum: number, a: any) => sum + (Number(a.asset_value_sar) || 0), 0)
    const latestOBE = obeRunsR.data?.[0] ?? null
    const recentAgentActivity = agentLogsR.data ?? []

    const agentSummary = recentAgentActivity.reduce((acc: Record<string, number>, log: any) => {
      acc[log.agent_type] = (acc[log.agent_type] || 0) + 1; return acc
    }, {})

    return NextResponse.json({
      connected: true,
      snapshot: {
        tenants: { total: tenantsR.count ?? 0, list: (tenantsR.data ?? []).map((t: any) => ({ name: t.name, plan: t.plan })) },
        projects: { total: projectsR.count ?? 0, active: (projectsR.data ?? []).filter((p: any) => p.status === 'active').length },
        assets: { total: assetsR.count ?? 0, totalValueSAR: totalAssetValue },
        obe: latestOBE ? {
          lastRun: latestOBE.created_at,
          totalBudgetSAR: latestOBE.total_budget_sar,
          engine: latestOBE._engine ?? 'claude',
        } : null,
        agents: { recentRuns: recentAgentActivity.length, byType: agentSummary },
        pulledAt: new Date().toISOString(),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ connected: false, error: err.message ?? 'Unknown error', snapshot: null })
  }
}
