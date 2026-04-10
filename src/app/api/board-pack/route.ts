/**
 * /api/board-pack — Board Pack Generator
 * Aggregates data from financials, exec (OKRs/decisions), IP vault, contracts,
 * tasks, and projects into a structured board-ready report with AI narrative.
 * PIOS v3.0 | VeritasIQ Technologies Ltd
 */
import { apiError } from '@/lib/api-error'
import { NextResponse }    from 'next/server'
import { createClient }    from '@/lib/supabase/server'
import { callClaude }      from '@/lib/ai/client'

export const runtime   = 'nodejs'
export const dynamic   = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const today     = new Date()
    const yearStart = new Date(today.getFullYear(), 0, 1).toISOString()
    const in90      = new Date(today.getTime() + 90 * 86400000).toISOString().slice(0, 10)

    // ── Parallel data fetch ────────────────────────────────────────────────
    const [
      snapshotsR, expensesR, okrsR, decisionsR, stakeholdersR,
      ipR, contractsR, tasksR, projectsR, profileR,
    ] = await Promise.all([
      supabase.from('financial_snapshots').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(3),
      supabase.from('expenses').select('amount,category,domain,expense_date')
        .eq('user_id', user.id).gte('expense_date', yearStart),
      supabase.from('exec_okrs').select('*, exec_key_results(*)')
        .eq('user_id', user.id).eq('status', 'active').limit(8),
      supabase.from('exec_decisions').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('exec_stakeholders').select('name,category,importance,relationship_status')
        .eq('user_id', user.id).order('importance').limit(10),
      supabase.from('ip_assets').select('name,type,status,registered_at,expiry_date,jurisdiction')
        .eq('user_id', user.id),
      supabase.from('contracts').select('title,value,currency,contract_type,status,end_date,counterparty')
        .eq('user_id', user.id).eq('status', 'active'),
      supabase.from('tasks').select('status,priority,domain,due_date')
        .eq('user_id', user.id).neq('status', 'cancelled'),
      supabase.from('projects').select('title,status,priority,domain,progress')
        .eq('user_id', user.id).neq('status', 'cancelled'),
      supabase.from('user_profiles').select('full_name,job_title,organisation,tenant_id')
        .eq('id', user.id).single(),
    ])

    // ── Process financials ─────────────────────────────────────────────────
    const snapshots  = (snapshotsR.data ?? []) as any[]
    const latestSnap = snapshots[0] ?? null
    const expenses   = (expensesR.data ?? []) as any[]
    const ytdExpenses = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0)

    // ── Process OKRs ──────────────────────────────────────────────────────
    const okrs = (okrsR.data ?? []) as any[]
    const okrSummary = okrs.map(o => ({
      title: o.title,
      progress: o.progress ?? 0,
      keyResults: (o.exec_key_results ?? []).map((kr: any) => ({
        title: kr.title, current: kr.current_value, target: kr.target_value,
      })),
    }))

    // ── Process decisions ────────────────────────────────────────────────
    const decisions = (decisionsR.data ?? []) as any[]

    // ── Process IP ─────────────────────────────────────────────────────
    const ipAssets   = (ipR.data ?? []) as any[]
    const ipExpiring = ipAssets.filter((a: any) => a.expiry_date && a.expiry_date <= in90)

    // ── Process contracts ────────────────────────────────────────────────
    const contracts      = (contractsR.data ?? []) as any[]
    const contractsTotal = contracts.reduce((s, c) => s + Number(c.value ?? 0), 0)
    const contractsExpiring = contracts.filter((c: any) => c.end_date && c.end_date <= in90)

    // ── Process tasks ────────────────────────────────────────────────────
    const tasks         = (tasksR.data ?? []) as any[]
    const openTasks     = tasks.filter(t => ['todo','in_progress','blocked'].includes(t.status))
    const criticalTasks = openTasks.filter(t => t.priority === 'critical')
    const overdueTasks  = openTasks.filter(t => t.due_date && t.due_date < today.toISOString().slice(0, 10))

    // ── Process projects ─────────────────────────────────────────────────
    const projects       = (projectsR.data ?? []) as any[]
    const activeProjects = projects.filter(p => p.status === 'active')

    // ── AI narrative ─────────────────────────────────────────────────────
    const profile = profileR.data as any
    const systemPrompt = `You are a board secretary preparing a concise board pack narrative for ${profile?.full_name ?? 'the CEO'}, ${profile?.job_title ?? 'Group CEO'} of ${profile?.organisation ?? 'VeritasIQ Technologies Ltd'}. Write in precise, board-appropriate language. Be direct and factual.`

    const dataContext = {
      financials: {
        latestRevenue: latestSnap?.revenue,
        latestExpenses: latestSnap?.expenses,
        latestCash: latestSnap?.cash_position,
        ytdExpenses,
        period: latestSnap?.period,
      },
      okrs: okrSummary,
      decisions: decisions.slice(0, 3).map((d: any) => ({ title: d.title, status: d.status, rationale: d.rationale?.slice(0, 150) })),
      ip: { total: ipAssets.length, expiringSoon: ipExpiring.length, statuses: Array.from(new Set(ipAssets.map((a: any) => a.status))) },
      contracts: { active: contracts.length, totalValue: contractsTotal, expiringSoon: contractsExpiring.length },
      tasks: { open: openTasks.length, critical: criticalTasks.length, overdue: overdueTasks.length },
      projects: { active: activeProjects.length, avgProgress: activeProjects.length ? Math.round(activeProjects.reduce((s, p) => s + (p.progress ?? 0), 0) / activeProjects.length) : 0 },
    }

    let aiNarrative: Record<string, string> = {}
    try {
      const raw = await callClaude([{
        role: 'user',
        content: `Generate a board pack executive narrative with exactly these sections. Data: ${JSON.stringify(dataContext)}\n\nReturn ONLY valid JSON:\n{\n  "chairOpening": "2-3 sentence board opening from chair perspective — period summary and tone",\n  "financialNarrative": "3-4 sentences on financial position, revenue trend, burn, key variances",\n  "strategicProgress": "3-4 sentences on OKR achievement, strategic milestones, notable wins",\n  "keyDecisions": "2-3 sentences summarising key decisions taken since last period",\n  "riskAlert": "2-3 sentences on IP expiries, contract renewals, overdue tasks — flagging items needing board attention",\n  "outlook": "2-3 sentences forward-looking: priorities for next quarter, key dependencies"\n}`,
      }], systemPrompt, 1000)
      const cleaned = raw.replace(/```json\n?|```/g, '').trim()
      aiNarrative = JSON.parse(cleaned)
    } catch { aiNarrative = {} }

    // ── Assemble pack ─────────────────────────────────────────────────────
    const pack = {
      meta: {
        generatedAt: today.toISOString(),
        period: latestSnap?.period ?? `Q${Math.ceil((today.getMonth() + 1) / 3)} ${today.getFullYear()}`,
        preparedBy: profile?.full_name ?? 'PIOS',
        organisation: profile?.organisation ?? 'VeritasIQ Technologies Ltd',
      },
      narrative: aiNarrative,
      financials: {
        snapshot: latestSnap,
        ytdExpenses,
        activeContracts: contracts.length,
        contractsValue: contractsTotal,
      },
      okrs: okrSummary,
      decisions,
      ip: { assets: ipAssets, expiringSoon: ipExpiring },
      contracts: { active: contracts, expiringSoon: contractsExpiring },
      tasks: { open: openTasks.length, critical: criticalTasks.length, overdue: overdueTasks.length },
      projects: { active: activeProjects },
      stakeholders: stakeholdersR.data ?? [],
      risks: [
        ...ipExpiring.map((a: any) => ({ type: 'IP', label: `${a.name} expires ${a.expiry_date}`, severity: 'high' })),
        ...contractsExpiring.map((c: any) => ({ type: 'Contract', label: `${c.title} expires ${c.end_date}`, severity: 'medium' })),
        ...(criticalTasks.length ? [{ type: 'Tasks', label: `${criticalTasks.length} critical task${criticalTasks.length > 1 ? 's' : ''} open`, severity: 'high' }] : []),
        ...(overdueTasks.length ? [{ type: 'Tasks', label: `${overdueTasks.length} task${overdueTasks.length > 1 ? 's' : ''} overdue`, severity: 'medium' }] : []),
      ],
    }

    return NextResponse.json(pack)
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal server error' }, { status: 500 })
  }
}
