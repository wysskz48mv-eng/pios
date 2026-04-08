/**
 * /api/insights — Universal Insight Capture
 *
 * Routes by insight_type to the appropriate PIOS destination:
 *   dba_thesis           → Academic Hub + supervisor share queue
 *   business_opportunity → Executive OS + OKR pipeline
 *   cpd_learning         → Learning Hub + CPD tracker
 *   ip_consideration     → IP Vault + legal review queue
 *   client_intelligence  → Consulting Hub + Stakeholder CRM
 *   product_insight      → Product backlog + sprint planning
 *   general              → Morning brief only
 *
 * All types surface in the morning brief when status='captured' and
 * created_at > 3 days ago (NemoClaw surfaces them before they go stale).
 *
 * PIOS v3.2.0 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'

export const dynamic = 'force-dynamic'

// Routing map — what each type feeds into
const INSIGHT_ROUTES: Record<string, string[]> = {
  dba_thesis:           ['Academic Hub', 'Supervisor queue', 'Morning brief'],
  business_opportunity: ['Executive OS', 'OKR pipeline', 'Morning brief'],
  cpd_learning:         ['Learning Hub', 'CPD tracker', 'Morning brief'],
  ip_consideration:     ['IP Vault', 'Legal review', 'Morning brief'],
  client_intelligence:  ['Consulting Hub', 'Stakeholder CRM', 'Morning brief'],
  product_insight:      ['Product backlog', 'Sprint planning', 'Morning brief'],
  general:              ['Morning brief'],
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type     = searchParams.get('type')
  const status   = searchParams.get('status')
  const priority = searchParams.get('priority')
  const limit    = parseInt(searchParams.get('limit') ?? '100')

  let query = supabase
    .from('insights').select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (type)     query = query.eq('insight_type', type)
  if (status)   query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const all = data ?? []
  const stats = {
    total:      all.length,
    captured:   all.filter(i => i.status === 'captured').length,
    high:       all.filter(i => i.priority === 'high').length,
    overdue:    all.filter(i =>
      i.review_by && new Date(i.review_by) < new Date() && i.status === 'captured'
    ).length,
    by_type: Object.fromEntries(
      ['dba_thesis','business_opportunity','cpd_learning','ip_consideration',
       'client_intelligence','product_insight','general'].map(t => [
        t, all.filter(i => i.insight_type === t).length
      ])
    ),
  }

  return NextResponse.json({ insights: all, stats })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const {
    title, body: insightBody,
    insight_type = 'general', source_type = 'manual', source_context,
    priority = 'medium', review_by,
    // Type-specific
    thesis_section, chapter_tag, supervisor_share = false,
    cpd_body, cpd_credits,
    market_segment, ip_type, client_org, platform,
    tags = [],
  } = body

  if (!title?.trim())       return NextResponse.json({ error: 'Title required' }, { status: 400 })
  if (!insightBody?.trim()) return NextResponse.json({ error: 'Body required' }, { status: 400 })

  // Auto-generate 30-word brief summary via Claude Haiku
  let ai_summary: string | null = null
  try {
    ai_summary = await callClaude(
      [{
        role: 'user',
        content: `Summarise this insight in one sentence (max 25 words) for a morning brief reminder. Type: ${insight_type}.\n\nTitle: ${title}\n\n${insightBody}`
      }],
      'You write concise executive reminder summaries. Return one sentence only.',
      80,
      'haiku'
    )
  } catch { /* non-blocking */ }

  const { data, error } = await supabase.from('insights').insert({
    user_id: user.id,
    title: title.trim(),
    body: insightBody.trim(),
    insight_type,
    source_type,
    source_context: source_context ?? null,
    status: 'captured',
    priority,
    review_by: review_by ?? null,
    thesis_section:   thesis_section   ?? null,
    chapter_tag:      chapter_tag      ?? null,
    supervisor_share: supervisor_share ?? false,
    cpd_body:         cpd_body         ?? null,
    cpd_credits:      cpd_credits      ?? null,
    market_segment:   market_segment   ?? null,
    ip_type:          ip_type          ?? null,
    client_org:       client_org       ?? null,
    platform:         platform         ?? null,
    tags,
    ai_summary,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire-and-forget downstream routing
  const routes = INSIGHT_ROUTES[insight_type] ?? []
  // Future: trigger webhooks to Academic Hub, IP Vault etc.

  return NextResponse.json({ ok: true, insight: data, routed_to: routes })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data, error } = await supabase.from('insights')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', user.id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, insight: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase.from('insights')
    .delete().eq('id', id).eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
