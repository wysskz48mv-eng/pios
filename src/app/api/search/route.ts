/**
 * GET /api/search?q=query&types=tasks,projects,files,meetings,knowledge
 * Cross-domain full-text search across all PIOS data
 * PIOS Sprint 62 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── Typed Supabase response helpers ──────────────────────────────────────────
type SBResult<T> = { data: T | null; error: { message: string } | null }
type SBRow = Record<string, unknown>


export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SearchResult {
  id: string
  type: 'task' | 'project' | 'file' | 'meeting' | 'knowledge' | 'expense' | 'contract' | 'ip_asset'
  title: string
  subtitle?: string
  domain?: string
  href: string
  matched_field?: string
  created_at?: string
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ results: [], query: q })

  const typesParam = req.nextUrl.searchParams.get('types') ?? 'all'
  const types = typesParam === 'all'
    ? ['tasks','projects','meetings','files','knowledge','expenses','contracts','ip_assets']
    : typesParam.split(',')

  const results: SearchResult[] = []
  const ilike = `%${q}%`
  const uid = user.id

  // Run searches in parallel
  const searches = await Promise.allSettled([

    // Tasks
    types.includes('tasks')
      ? supabase.from('tasks')
          .select('id,title,domain,status,due_date')
          .eq('user_id', uid)
          .or(`title.ilike.${ilike},description.ilike.${ilike}`)
          .limit(5)
      : null,

    // Projects
    types.includes('projects')
      ? supabase.from('projects')
          .select('id,title,domain,status,progress')
          .eq('user_id', uid)
          .or(`title.ilike.${ilike},description.ilike.${ilike}`)
          .limit(4)
      : null,

    // Meeting notes
    types.includes('meetings')
      ? supabase.from('meeting_notes')
          .select('id,title,meeting_date,meeting_type,ai_summary')
          .eq('user_id', uid)
          .or(`title.ilike.${ilike},content.ilike.${ilike},ai_summary.ilike.${ilike}`)
          .limit(4)
      : null,

    // Files
    types.includes('files')
      ? supabase.from('file_items')
          .select('id,name,file_type,ai_category,summary')
          .eq('user_id', uid)
          .or(`name.ilike.${ilike},summary.ilike.${ilike}`)
          .limit(4)
      : null,

    // Knowledge entries
    types.includes('knowledge')
      ? supabase.from('knowledge_entries')
          .select('id,title,summary,domain,entry_type')
          .eq('user_id', uid)
          .or(`title.ilike.${ilike},summary.ilike.${ilike},full_text.ilike.${ilike}`)
          .limit(4)
      : null,

    // Expenses
    types.includes('expenses')
      ? supabase.from('expense_claims')
          .select('id,description,amount,currency,category,date')
          .eq('user_id', uid)
          .ilike('description', ilike)
          .limit(3)
      : null,

    // Contracts (if M019 run)
    types.includes('contracts')
      ? supabase.from('contracts')
          .select('id,title,counterparty,contract_type,status')
          .eq('user_id', uid)
          .or(`title.ilike.${ilike},counterparty.ilike.${ilike},key_terms.ilike.${ilike}`)
          .limit(3)
      : null,

    // IP Assets (if M019 run)
    types.includes('ip_assets')
      ? supabase.from('ip_assets')
          .select('id,name,asset_type,status,description')
          .eq('user_id', uid)
          .or(`name.ilike.${ilike},description.ilike.${ilike}`)
          .limit(3)
      : null,
  ])

  const [tasksR, projR, meetR, filesR, knowR, expR, conR, ipR] = searches

  // Tasks
  for (const t of (tasksR as any)?.value?.data ?? []) {
    results.push({ id: t.id, type: 'task', title: t.title,
      subtitle: `${t.domain} · ${t.status}${t.due_date ? ' · due ' + t.due_date.slice(0,10) : ''}`,
      domain: t.domain, href: '/platform/tasks' })
  }

  // Projects
  for (const p of (projR as any)?.value?.data ?? []) {
    results.push({ id: p.id, type: 'project', title: p.title,
      subtitle: `${p.domain} · ${p.progress ?? 0}% complete`,
      domain: p.domain, href: '/platform/projects' })
  }

  // Meetings
  for (const m of (meetR as any)?.value?.data ?? []) {
    results.push({ id: m.id, type: 'meeting', title: m.title,
      subtitle: `${m.meeting_type} · ${m.meeting_date}`,
      href: '/platform/meetings' })
  }

  // Files
  for (const f of (filesR as any)?.value?.data ?? []) {
    results.push({ id: f.id, type: 'file', title: f.name,
      subtitle: `${f.file_type?.toUpperCase()} · ${f.ai_category ?? 'unclassified'}`,
      href: '/platform/files' })
  }

  // Knowledge
  for (const k of (knowR as any)?.value?.data ?? []) {
    results.push({ id: k.id, type: 'knowledge', title: k.title,
      subtitle: `${k.entry_type} · ${k.domain}`,
      domain: k.domain, href: '/platform/knowledge' })
  }

  // Expenses
  for (const e of (expR as any)?.value?.data ?? []) {
    results.push({ id: e.id, type: 'expense', title: e.description,
      subtitle: `${e.currency} ${e.amount} · ${e.category ?? ''}`,
      href: '/platform/expenses' })
  }

  // Contracts
  for (const c of (conR as any)?.value?.data ?? []) {
    results.push({ id: c.id, type: 'contract', title: c.title,
      subtitle: `${c.contract_type} · ${c.counterparty} · ${c.status}`,
      href: '/platform/contracts' })
  }

  // IP Assets
  for (const ip of (ipR as any)?.value?.data ?? []) {
    results.push({ id: ip.id, type: 'ip_asset', title: ip.name,
      subtitle: `${ip.asset_type} · ${ip.status}`,
      href: '/platform/ip-vault' })
  }

  // Sort: exact title matches first, then partial
  results.sort((a, b) => {
    const aExact = a.title.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1
    const bExact = b.title.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1
    return aExact - bExact
  })

  return NextResponse.json({ results: results.slice(0, 20), query: q, total: results.length })
}
