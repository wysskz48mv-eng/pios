/**
 * /api/admin/seed-demo — Demo data seeder for sales demos & first-run experience
 * Seeds realistic data for the Professional/CEO persona
 * PIOS Sprint 44 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: prof } = await (supabase as any)
      .from('user_profiles').select('tenant_id,full_name').eq('id', user.id).single()
    const p = prof as any
    if (!p?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const body = await req.json() as Record<string, unknown>
    const { confirm } = body
    if (confirm !== 'SEED_DEMO') {
      return NextResponse.json({ error: 'Pass confirm: "SEED_DEMO" to proceed' }, { status: 400 })
    }

    const now  = new Date()
    const uid  = user.id
    const tid  = p.tenant_id
    const name = p.full_name ?? 'Demo User'
    const seeded: string[] = []

    // ── 1. Tasks ─────────────────────────────────────────────────────────────
    const tasks = [
      { title: 'Review PIOS v2.8 deployment checklist', domain: 'saas', priority: 'high', status: 'pending', due_date: new Date(now.getTime() - 86400000).toISOString().slice(0,10) },
      { title: 'Send Qiddiya proposal final draft', domain: 'fm_consulting', priority: 'critical', status: 'pending', due_date: new Date(now.getTime() + 86400000).toISOString().slice(0,10) },
      { title: 'File VeritasIQ trademark — IP Office', domain: 'business', priority: 'high', status: 'pending', due_date: new Date(now.getTime() + 3*86400000).toISOString().slice(0,10) },
      { title: 'Review Q1 payroll run for 3 contractors', domain: 'business', priority: 'medium', status: 'pending', due_date: new Date(now.getTime() + 2*86400000).toISOString().slice(0,10) },
      { title: 'Update InvestiScript investor deck with Q1 traction', domain: 'saas', priority: 'medium', status: 'in_progress' },
      { title: 'Record demo video for VeritasEdge v6.6', domain: 'saas', priority: 'medium', status: 'in_progress' },
    ]
    for (const t of tasks) {
      await (supabase as any).from('tasks').insert({ ...t, user_id: uid, tenant_id: tid })
    }
    seeded.push(`${tasks.length} tasks`)

    // ── 2. Executive OKRs ─────────────────────────────────────────────────────
    const okrs = [
      { title: 'Launch PIOS commercially with 10 paying users', health: 'on_track', progress: 65, period: 'Q2 2026', status: 'active' },
      { title: 'Close first VeritasEdge enterprise contract', health: 'at_risk', progress: 30, period: 'Q2 2026', status: 'active' },
      { title: 'Complete all 4 VeritasIQ trademark filings', health: 'on_track', progress: 50, period: 'Q2 2026', status: 'active' },
    ]
    for (const okr of okrs) {
      await (supabase as any).from('exec_okrs').insert({ ...okr, user_id: uid, tenant_id: tid })
    }
    seeded.push(`${okrs.length} OKRs`)

    // ── 3. Exec decisions ─────────────────────────────────────────────────────
    const decisions = [
      { title: 'Should PIOS pricing be £/$ dual currency at launch?', framework_used: 'CPA', status: 'open', context: 'Target market includes both UK and UAE users. USD pricing simplifies Stripe but may alienate UK-first positioning.', options: ['USD only', 'GBP primary with USD option', 'Dynamic by region'] },
      { title: 'Hire a part-time developer or continue with Claude-first approach?', framework_used: 'OAE', status: 'open', context: 'Current velocity is good with AI-assisted development. Risk is single-point-of-failure on technical knowledge.' },
      { title: 'Launch VeritasEdge on Product Hunt before or after first customer?', framework_used: 'POM', status: 'open', context: 'Pre-customer launch generates buzz but risks negative feedback on rough edges. Post-customer validates product-market fit.' },
    ]
    for (const d of decisions) {
      await (supabase as any).from('exec_decisions').insert({ ...d, user_id: uid, tenant_id: tid })
    }
    seeded.push(`${decisions.length} exec decisions`)

    // ── 4. Stakeholders ───────────────────────────────────────────────────────
    const today = now.toISOString().slice(0,10)
    const in3   = new Date(now.getTime() + 3*86400000).toISOString().slice(0,10)
    const in7   = new Date(now.getTime() + 7*86400000).toISOString().slice(0,10)
    const in14  = new Date(now.getTime() + 14*86400000).toISOString().slice(0,10)
    const stakeholders = [
      { name: 'Qiddiya Investment Company (QPMO)', relationship: 'client_prospect', importance: 'critical', next_touchpoint: in3, notes: 'RFP QPMO-410-CT-07922 submitted. Awaiting shortlist notification.', last_contact: today },
      { name: 'VeritasEdge Lead Investor', relationship: 'investor', importance: 'critical', next_touchpoint: in7, notes: 'Q1 update due. Wants commercial traction evidence before Series A bridge.' },
      { name: 'UK IPO — Trademark Examiner', relationship: 'regulatory', importance: 'high', next_touchpoint: in14, notes: 'VeritasEdge and VeritasIQ filings in review. Respond to any office actions within 2 months.' },
    ]
    for (const s of stakeholders) {
      await (supabase as any).from('exec_stakeholders').insert({ ...s, user_id: uid, tenant_id: tid })
    }
    seeded.push(`${stakeholders.length} stakeholders`)

    // ── 5. IP Assets (if table exists) ───────────────────────────────────────
    try {
      const ipAssets = [
        { name: 'HDCA™ — Holistic Diagnostic & Calibration Algorithm', asset_type: 'patent', status: 'pending', description: 'Core algorithmic IP for VeritasEdge service charge benchmarking. Patent application filed.', owner_entity: 'VeritasIQ Technologies Ltd', jurisdiction: ['UK', 'UAE'], tags: ['veritasedge', 'patent', 'algorithm'] },
        { name: 'VeritasEdge™', asset_type: 'trademark', status: 'filed', description: 'Platform trademark for GCC FM service charge management SaaS.', owner_entity: 'VeritasIQ Technologies Ltd', jurisdiction: ['UK'], tags: ['trademark', 'brand'] },
        { name: 'NemoClaw™', asset_type: 'trademark', status: 'filed', description: 'AI consulting framework engine trademark.', owner_entity: 'VeritasIQ Technologies Ltd', jurisdiction: ['UK'], tags: ['trademark', 'ai'] },
        { name: 'POM™ — Portfolio Opportunity Matrix', asset_type: 'framework', status: 'active', description: 'Proprietary consulting framework replacing BCG Growth-Share Matrix.', owner_entity: 'VeritasIQ Technologies Ltd', jurisdiction: ['UK', 'UAE'], tags: ['NemoClaw', 'consulting'] },
        { name: 'IML™ — Institutional Memory Layer', asset_type: 'framework', status: 'active', description: 'SE-MIL knowledge compounding framework for consulting practices.', owner_entity: 'VeritasIQ Technologies Ltd', jurisdiction: ['UK', 'UAE'], tags: ['NemoClaw', 'consulting'] },
      ]
      for (const ip of ipAssets) {
        await (supabase as any).from('ip_assets').insert({ ...ip, user_id: uid, tenant_id: tid })
      }
      seeded.push(`${ipAssets.length} IP assets`)
    } catch { seeded.push('IP assets: table not yet migrated (run M019)') }

    // ── 6. Knowledge entries ──────────────────────────────────────────────────
    try {
      const knowledge = [
        { title: 'GCC FM Service Charge Market — 2025 Benchmarks', entry_type: 'market_intelligence', domain: 'fm_consulting', summary: 'CBRE data shows AED 45-85/sqm for Class A retail in Dubai Mall district. Cooling systems account for 35-40% of total SC in arid environments. KSA giga-projects budgeting SAR 2,400/sqm for full-service community management.', tags: ['gcc', 'benchmarking', 'service-charge', '2025'] },
        { title: 'PIOS ICP: Non-Technical Founders Building SaaS', entry_type: 'client_insight', domain: 'saas', summary: 'Key insight from early testing: non-technical founders with business domain expertise are underserved by developer-first tools. They need AI that speaks in business outcomes, not code. Daily brief + command centre resonates most strongly.', tags: ['icp', 'pios', 'founder', 'product-market-fit'] },
        { title: 'Qiddiya City Service Charge Framework — RFP Intelligence', entry_type: 'case_study', domain: 'fm_consulting', summary: 'Qiddiya requires IFMA-compliant service charge model across 3 districts. Benchmarking against Riyadh Vision 2030 projects. SAR 180-240/sqm target. 5-year contract with annual review mechanism. Key differentiator: real-time dashboard with resident portal integration.', tags: ['qiddiya', 'rfp', 'ksa', 'service-charge'] },
      ]
      for (const k of knowledge) {
        await (supabase as any).from('knowledge_entries').insert({ ...k, user_id: uid, tenant_id: tid })
      }
      seeded.push(`${knowledge.length} knowledge entries`)
    } catch { seeded.push('Knowledge entries: table not yet migrated (run M020)') }

    // ── 7. Contracts ──────────────────────────────────────────────────────────
    try {
      const contracts = [
        { title: 'Claude API — Anthropic Developer Agreement', contract_type: 'supplier', counterparty: 'Anthropic PBC', status: 'active', currency: 'USD', domain: 'saas', key_terms: 'Pay-per-token. Claude claude-sonnet-4-6 primary model. 200k token context window.', auto_renewal: true },
        { title: 'Vercel Pro — Hosting Agreement', contract_type: 'supplier', counterparty: 'Vercel Inc', status: 'active', value: 240, currency: 'USD', domain: 'saas', end_date: new Date(now.getFullYear()+1, now.getMonth(), now.getDate()).toISOString().slice(0,10), auto_renewal: true },
        { title: 'Supabase Pro — Database Agreement', contract_type: 'supplier', counterparty: 'Supabase Inc', status: 'active', value: 300, currency: 'USD', domain: 'saas', auto_renewal: true },
      ]
      for (const c of contracts) {
        await (supabase as any).from('contracts').insert({ ...c, user_id: uid, tenant_id: tid })
      }
      seeded.push(`${contracts.length} contracts`)
    } catch { seeded.push('Contracts: table not yet migrated (run M019)') }

    // ── 8. OKR Key Results (sprint 86) ───────────────────────────────────────
    try {
      const { data: existingOkrs } = await (supabase as any)
        .from('exec_okrs').select('id,title').eq('user_id', uid).limit(3)
      if (existingOkrs?.length > 0) {
        const okrKRs = [
          { objective_title: 'Launch PIOS commercially', krs: [
            { title: 'Paying users', metric_type: 'number', target: 10, current: 3, unit: 'users', status: 'on_track' },
            { title: 'MRR achieved', metric_type: 'currency', target: 240, current: 72, unit: '£', status: 'on_track' },
            { title: 'Trial-to-paid conversion', metric_type: 'percentage', target: 40, current: 25, unit: '%', status: 'at_risk' },
          ]},
          { objective_title: 'Close first VeritasEdge enterprise', krs: [
            { title: 'Enterprise demos delivered', metric_type: 'number', target: 5, current: 1, unit: 'demos', status: 'at_risk' },
            { title: 'Contract value pipeline', metric_type: 'currency', target: 150000, current: 45000, unit: '£', status: 'at_risk' },
          ]},
          { objective_title: 'Complete all 4 trademark filings', krs: [
            { title: 'Filings submitted', metric_type: 'number', target: 4, current: 2, unit: 'filings', status: 'on_track' },
          ]},
        ]
        for (const okrGroup of okrKRs) {
          const matchingOkr = existingOkrs.find((o: any) =>
            String(o.title ?? '').toLowerCase().includes(okrGroup.objective_title.toLowerCase().slice(0, 12))
          )
          if (matchingOkr) {
            for (const kr of okrGroup.krs) {
              await (supabase as any).from('exec_key_results').insert({
                ...kr, objective_id: matchingOkr.id, user_id: uid, tenant_id: tid,
              })
            }
          }
        }
        seeded.push(`${okrKRs.flatMap(o => o.krs).length} OKR key results`)
      }
    } catch { seeded.push('OKR key results: skipped (exec_key_results table may need M015)') }

    // ── 9. Wellness session (sprint 86) ──────────────────────────────────────
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { data: existing } = await (supabase as any)
        .from('wellness_sessions').select('id').eq('user_id', uid).eq('session_date', today).limit(1)
      if (!existing?.length) {
        await (supabase as any).from('wellness_sessions').insert({
          user_id: uid, tenant_id: tid,
          session_date: today, session_type: 'morning_checkin',
          mood_score: 7, energy_score: 8, stress_score: 5, focus_score: 8,
          dominant_domain: 'saas', gdpr_consent: true, data_minimised: true,
          ai_insight: 'High energy day — ideal for strategic work and investor conversations. Stress is moderate; block time for deep focus on the Qiddiya proposal before 2pm.',
          ai_recommended_actions: [
            { action: 'Schedule 90-minute deep work block for Qiddiya RFP', priority: 'high', timeframe: 'today' },
            { action: 'Review PIOS pricing page before investor call', priority: 'high', timeframe: 'today' },
            { action: 'Short walk at noon to maintain energy', priority: 'medium', timeframe: 'today' },
          ],
          source: 'demo_seed',
        })
        // Seed a streak too
        await (supabase as any).from('wellness_streaks').upsert({
          user_id: uid, streak_type: 'daily_checkin',
          current_streak: 7, longest_streak: 14,
          last_activity_date: today,
        }, { onConflict: 'user_id,streak_type' })
        seeded.push('1 wellness session (today) + 7-day streak')
      } else {
        seeded.push('Wellness session: already exists for today')
      }
    } catch { seeded.push('Wellness: table not yet migrated (run M021)') }

    // ── 10. Financial snapshot (sprint 86) ───────────────────────────────────
    try {
      const month = new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
      const { data: existingSnap } = await (supabase as any)
        .from('financial_snapshots').select('id').eq('user_id', uid).eq('period', month).limit(1)
      if (!existingSnap?.length) {
        await (supabase as any).from('financial_snapshots').insert({
          user_id: uid, tenant_id: tid,
          period: month, period_type: 'month', entity: 'group',
          revenue: 4800, expenses: 2100, payroll_cost: 0,
          cash_position: 18400, receivables: 12000, payables: 1800,
          currency: 'GBP',
          notes: 'Demo snapshot — VeritasIQ Technologies Ltd group P&L',
          ai_commentary: 'Revenue tracking ahead of Q2 target. Cash position healthy at £18.4k. Receivables of £12k pending from FM consultancy engagements.',
        })
        seeded.push(`1 financial snapshot (${month})`)
      } else {
        seeded.push('Financial snapshot: already exists for this month')
      }
    } catch { seeded.push('Financial snapshot: table not yet migrated (run M019)') }

    return NextResponse.json({ ok: true, seeded, message: `Demo data seeded: ${seeded.join(', ')}` })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
