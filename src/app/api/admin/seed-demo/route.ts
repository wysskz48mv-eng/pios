import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

/**
 * POST /api/admin/seed-demo
 * Seeds realistic demo data for investor demonstrations.
 * Protected by SEED_SECRET header.
 *
 * Seeds per authenticated user:
 *   - 6 tasks (mix of priorities, some overdue)
 *   - 3 OKRs with progress
 *   - 3 decisions (open + pending)
 *   - 3 IP assets (VeritasEdge™, InvestiScript™, PIOS)
 *   - 2 contracts (GCC FM Consultancy retainer, Pocket FM)
 *   - 2 financial snapshots
 *   - Blood Oath Chronicles series
 *   - 2 stakeholders
 *   - 2 publications (DBA research)
 *
 * Idempotent — safe to re-run.
 * VeritasIQ Technologies Ltd · PIOS
 */

export const dynamic     = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const secret   = process.env.SEED_SECRET
  const provided = req.headers.get('x-seed-secret') ?? req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get the first user
  const { data: users } = await admin.auth.admin.listUsers()
  const user = users?.users?.[0]
  if (!user) return NextResponse.json({ error: 'No users found' }, { status: 404 })
  const uid = user.id

  const results: string[] = []
  const now = new Date()

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const tasks = [
    {
      title:       'Complete Qiddiya RFP submission',
      priority:    'high',
      status:      'in_progress',
      due_date:    new Date(now.getTime() + 17 * 86400000).toISOString().split('T')[0],
      category:    'business',
      description: 'QPMO-410-CT-07922 — deadline 14 April 2026. All 17 sections + cover letter.',
    },
    {
      title:       'Companies House registration',
      priority:    'high',
      status:      'todo',
      due_date:    new Date(now.getTime() + 3 * 86400000).toISOString().split('T')[0],
      category:    'legal',
      description: 'Unblocks trademark filing for VeritasEdge™ and VeritasIQ.',
    },
    {
      title:       'File VeritasEdge™ trademark (IPO)',
      priority:    'high',
      status:      'todo',
      due_date:    new Date(now.getTime() + 10 * 86400000).toISOString().split('T')[0],
      category:    'legal',
      description: '£340 filing fee. TM_v2 docs ready. Requires Companies House number first.',
    },
    {
      title:       'DBA supervisory meeting — Prof Mitchell',
      priority:    'medium',
      status:      'todo',
      due_date:    new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0],
      category:    'academic',
      description: 'Present VeritasEdge™ as case context using Strategy 3 additive specification.',
    },
    {
      title:       'PIOS investor demo preparation',
      priority:    'medium',
      status:      'in_progress',
      due_date:    new Date(now.getTime() + 5 * 86400000).toISOString().split('T')[0],
      category:    'business',
      description: 'Platform live. Seed demo data. Prepare 15-min walkthrough deck.',
    },
    {
      title:       'Blood Oath Chronicles — Episode 72 draft',
      priority:    'low',
      status:      'todo',
      due_date:    new Date(now.getTime() + 2 * 86400000).toISOString().split('T')[0],
      category:    'content',
      description: 'Target: 1,375 words. Kaelo confronts the Matryoshka layer 3 reveal.',
    },
  ]

  let taskCount = 0
  for (const task of tasks) {
    const { error } = await admin.from('tasks').upsert({
      user_id:    uid,
      ...task,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id,title' })
    if (!error) taskCount++
  }
  results.push(`✓ Tasks: ${taskCount}/${tasks.length} seeded`)

  // ── OKRs ──────────────────────────────────────────────────────────────────
  const okrs = [
    {
      title:        'Launch PIOS to first 10 paying customers',
      description:  'Q1/Q2 2026 — target £2,900 MRR from Starter tier',
      progress_pct: 35,
      health:       'on_track',
      quarter:      'Q2',
      year:         2026,
    },
    {
      title:        'Win Qiddiya FM contract (QPMO-410-CT-07922)',
      description:  'SAR 50M+ contract. Submission deadline 14 April 2026.',
      progress_pct: 60,
      health:       'on_track',
      quarter:      'Q1',
      year:         2026,
    },
    {
      title:        'Complete DBA research proposal',
      description:  'University of Portsmouth. Supervisor: Prof Mitchell.',
      progress_pct: 45,
      health:       'at_risk',
      quarter:      'Q2',
      year:         2026,
    },
  ]

  let okrCount = 0
  for (const okr of okrs) {
    const { error } = await admin.from('okrs').upsert({
      user_id:    uid,
      ...okr,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id,title' })
    if (!error) okrCount++
  }
  results.push(`✓ OKRs: ${okrCount}/${okrs.length} seeded`)

  // ── Decisions ─────────────────────────────────────────────────────────────
  const decisions = [
    {
      title:       'Qiddiya consortium submission — solo vs partner',
      status:      'open',
      context:     'Tuesday meeting determines whether VeritasIQ submits solo or as part of a consortium. PI insurance requirement varies by route.',
      options:     JSON.stringify(['Solo submission (full IP control)', 'Consortium (shared risk, reduced revenue)']),
      deadline:    new Date(now.getTime() + 4 * 86400000).toISOString().split('T')[0],
      impact:      'high',
    },
    {
      title:       'PIOS pricing — launch at Starter or Pro tier',
      status:      'pending_review',
      context:     'Starter at £29/mo targets individual consultants. Pro at £79/mo targets founders with teams. Which to lead with for market entry?',
      options:     JSON.stringify(['Lead with Starter (volume)', 'Lead with Pro (value)', 'Freemium then upgrade']),
      deadline:    new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0],
      impact:      'high',
    },
    {
      title:       'Trademark filing — VeritasEdge™ before or after Companies House',
      status:      'open',
      context:     'IPO filing requires company name as applicant. Companies House registration (£50) must complete first. Conflict searches clear.',
      options:     JSON.stringify(['Register CH first (correct sequence)', 'File TM in personal name as interim']),
      deadline:    new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0],
      impact:      'medium',
    },
  ]

  let decCount = 0
  for (const dec of decisions) {
    const { error } = await admin.from('decisions').upsert({
      user_id:    uid,
      ...dec,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id,title' })
    if (!error) decCount++
  }
  results.push(`✓ Decisions: ${decCount}/${decisions.length} seeded`)

  // ── IP Assets ─────────────────────────────────────────────────────────────
  const ipAssets = [
    {
      name:         'VeritasEdge™',
      type:         'trademark',
      status:       'active',
      description:  'FM/service charge intelligence platform. SE-CAFX, HDCA™, VIQ-MIL™, SE-BENCH proprietary methodologies.',
      jurisdiction: 'UK',
      filing_date:  null,
      expiry_date:  new Date(now.getTime() + 365 * 86400000).toISOString().split('T')[0],
      notes:        'TM_v2 docs ready. Pending Companies House registration.',
    },
    {
      name:         'NemoClaw™ Framework',
      type:         'trade_secret',
      status:       'active',
      description:  '13 proprietary coaching frameworks (SDL/POM/OAE/CVDM/CPA/UMS/VFO/CFE/ADF/GSM/SPA/RTE/IML). Professional-tier only.',
      jurisdiction: 'UK',
      expiry_date:  null,
      notes:        'Core PIOS IP. Not filed — maintained as trade secret.',
    },
    {
      name:         'InvestiScript™',
      type:         'trademark',
      status:       'active',
      description:  'AI investigative journalism platform targeting Southern African media markets.',
      jurisdiction: 'UK',
      expiry_date:  new Date(now.getTime() + 365 * 86400000).toISOString().split('T')[0],
      notes:        'Q2 2026 trademark filing planned.',
    },
  ]

  let ipCount = 0
  for (const ip of ipAssets) {
    const { error } = await admin.from('ip_assets').upsert({
      user_id:    uid,
      ...ip,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id,name' })
    if (!error) ipCount++
  }
  results.push(`✓ IP assets: ${ipCount}/${ipAssets.length} seeded`)

  // ── Financial snapshots ───────────────────────────────────────────────────
  const financials = [
    {
      period:         'Q1 2026',
      revenue_gbp:    0,
      burn_gbp:       850,
      runway_months:  18,
      arr_gbp:        0,
      mrr_gbp:        0,
      notes:          'Pre-revenue. Infrastructure costs only. PIOS + VE + IS hosting.',
    },
    {
      period:         'Q2 2026 (projected)',
      revenue_gbp:    2900,
      burn_gbp:       1200,
      runway_months:  16,
      arr_gbp:        34800,
      mrr_gbp:        2900,
      notes:          'Projected: 10 PIOS Starter customers + Qiddiya contract TBD.',
    },
  ]

  let finCount = 0
  for (const fin of financials) {
    const { error } = await admin.from('financial_snapshots').upsert({
      user_id:    uid,
      ...fin,
      created_at: now.toISOString(),
    }, { onConflict: 'user_id,period' })
    if (!error) finCount++
  }
  results.push(`✓ Financials: ${finCount}/${financials.length} snapshots seeded`)

  // ── Stakeholders ──────────────────────────────────────────────────────────
  const stakeholders = [
    {
      name:         'Prof Mitchell',
      role:         'DBA Supervisor',
      organisation: 'University of Portsmouth',
      influence:    4,
      alignment:    5,
      engagement:   'high',
      notes:        'Supervisory meeting needed to present VeritasEdge™ as DBA case context.',
      next_action:  'Schedule meeting — present Strategy 3 additive specification',
    },
    {
      name:         'QIC Procurement',
      role:         'RFP Evaluator',
      organisation: 'Qiddiya Investment Company',
      influence:    5,
      alignment:    3,
      engagement:   'medium',
      notes:        'QPMO-410-CT-07922. Consortium meeting Tuesday ~1 Apr 2026.',
      next_action:  'Confirm submission route after Tuesday consortium meeting',
    },
  ]

  let shCount = 0
  for (const sh of stakeholders) {
    const { error } = await admin.from('stakeholders').upsert({
      user_id:    uid,
      ...sh,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id,name' })
    if (!error) shCount++
  }
  results.push(`✓ Stakeholders: ${shCount}/${stakeholders.length} seeded`)

  // ── Publications ──────────────────────────────────────────────────────────
  const publications = [
    {
      title:  'AI-Enabled FM Cost Forecasting in GCC Mixed-Use Developments',
      type:   'thesis',
      status: 'in_progress',
      venue:  'University of Portsmouth DBA Programme',
      authors: 'Dimitry Masuku',
      year:   2026,
      notes:  'Supervisor: Prof Mitchell. VeritasEdge™ as case study context.',
    },
    {
      title:  'Service Charge Governance in Saudi Master Communities: A Socio-Technical Perspective',
      type:   'journal',
      status: 'draft',
      venue:  'Journal of Facilities Management',
      authors: 'Dimitry Masuku',
      year:   2026,
      notes:  'Derived from DBA research. MOMRA 2024 compliance framework.',
    },
  ]

  let pubCount = 0
  for (const pub of publications) {
    const { error } = await admin.from('publications').upsert({
      user_id:    uid,
      ...pub,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id,title' })
    if (!error) pubCount++
  }
  results.push(`✓ Publications: ${pubCount}/${publications.length} seeded`)

  // ── Blood Oath Chronicles ─────────────────────────────────────────────────
  const { data: existing } = await admin.from('content_series')
    .select('id').eq('user_id', uid).eq('slug', 'blood-oath-chronicles').single()

  if (!existing) {
    const { error } = await admin.from('content_series').insert({
      user_id:          uid,
      title:            'Blood Oath Chronicles',
      slug:             'blood-oath-chronicles',
      platform:         'pocket_fm',
      genre:            'African supernatural thriller',
      status:           'active',
      total_episodes:   174,
      current_episode:  72,
      word_target:      1375,
      published_episodes: 71,
      created_at:       now.toISOString(),
      updated_at:       now.toISOString(),
    })
    results.push(error ? `⚠ BAC series: ${error.message}` : '✓ Blood Oath Chronicles series seeded')
  } else {
    results.push('✓ Blood Oath Chronicles series already exists')
  }

  const passed = results.filter(r => r.startsWith('✓')).length
  const warned = results.filter(r => r.startsWith('⚠')).length

  return NextResponse.json({
    ok:      warned === 0,
    results,
    summary: `${passed} succeeded, ${warned} warnings`,
    user_id: uid,
  })
}
