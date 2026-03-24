/**
 * /api/knowledge — SE-MIL Knowledge Base: search, save, retrieve
 * RAG-backed institutional memory for consulting and academic work
 * PIOS Sprint 38 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { callClaude }                from '@/lib/ai/client'

export const runtime    = 'nodejs'
export const maxDuration = 45

const DOMAINS = ['all','fm_consulting','academic','saas','business','personal'] as const

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const q      = searchParams.get('q') ?? ''
    const domain = searchParams.get('domain') ?? 'all'
    const limit  = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)

    let query = (supabase as any)
      .from('knowledge_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (domain !== 'all') query = query.eq('domain', domain)
    if (q.trim()) query = query.or(
      `title.ilike.%${q}%,summary.ilike.%${q}%,tags.cs.{${q.toLowerCase()}}`
    )

    const { data, error } = await query
    if (error) throw error

    // Stats
    const statsR = await (supabase as any)
      .from('knowledge_entries')
      .select('domain, entry_type')
      .eq('user_id', user.id)

    const entries = (statsR.data ?? []) as any[]
    const byDomain: Record<string, number> = {}
    const byType:   Record<string, number> = {}
    entries.forEach((e: any) => {
      byDomain[e.domain] = (byDomain[e.domain] ?? 0) + 1
      byType[e.entry_type] = (byType[e.entry_type] ?? 0) + 1
    })

    return NextResponse.json({ entries: data ?? [], total: entries.length, byDomain, byType })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: prof } = await (supabase as any)
      .from('user_profiles').select('tenant_id,full_name,organisation').eq('id', user.id).single()
    const p = prof as any
    if (!p?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const body = await req.json() as Record<string, unknown>
    const action = body.action as string

    // ── AI-powered search (semantic) ─────────────────────────────────────────
    if (action === 'ai_search') {
      const { query: userQuery, domain } = body as any
      const { data: entries } = await (supabase as any)
        .from('knowledge_entries')
        .select('title,summary,domain,entry_type,tags,source,created_at')
        .eq('user_id', user.id)
        .limit(30)

      const kb = (entries ?? []).map((e: any, i: number) =>
        `[${i+1}] ${e.title} (${e.entry_type}, ${e.domain})\n${e.summary}`
      ).join('\n\n')

      if (!kb.trim()) return NextResponse.json({ answer: 'No knowledge entries yet. Add some first.' })

      const answer = await callClaude([{
        role: 'user',
        content: `You are the SE-MIL (Structured Expert Memory & Institutional Learning) engine for ${p.full_name ?? 'a consultant'} at ${p.organisation ?? 'a firm'}.

Search the knowledge base for: "${userQuery}"
${domain && domain !== 'all' ? `Focus on domain: ${domain}` : ''}

Knowledge base:
${kb}

Provide:
1. DIRECT ANSWER — what the knowledge base says about this query
2. RELEVANT ENTRIES — cite entry numbers [1], [2] etc.
3. GAPS — what is NOT covered that would be useful to add
4. SUGGESTED FOLLOW-UP — one question to deepen this knowledge area

Be specific and cite entries. If nothing is relevant, say so honestly.`
      }], 'claude-sonnet-4-20250514', 0.3)

      // Log the search query
      await (supabase as any).from('knowledge_entries').insert({
        user_id: user.id, tenant_id: p.tenant_id,
        title: `Search: ${userQuery}`, summary: answer,
        entry_type: 'ai_search_result', domain: domain ?? 'all',
        tags: ['search', 'ai-generated'], source: 'SE-MIL Search',
        is_search_result: true,
      }).select()

      return NextResponse.json({ answer })
    }

    // ── Save new knowledge entry ──────────────────────────────────────────────
    if (action === 'save') {
      const { data, error } = await (supabase as any).from('knowledge_entries').insert({
        user_id: user.id, tenant_id: p.tenant_id,
        title:      body.title,
        summary:    body.summary,
        full_text:  body.full_text ?? null,
        entry_type: body.entry_type ?? 'note',
        domain:     body.domain ?? 'business',
        tags:       body.tags ?? [],
        source:     body.source ?? null,
        url:        body.url ?? null,
        is_search_result: false,
      }).select().single()
      if (error) throw error
      return NextResponse.json({ entry: data })
    }

    // ── AI summary from pasted text ───────────────────────────────────────────
    if (action === 'summarise') {
      const { text, title } = body as any
      const summary = await callClaude([{
        role: 'user',
        content: `Summarise the following for the SE-MIL knowledge base of a founder/consultant.

Title: ${title}

Text:
${text}

Produce:
1. SUMMARY (3-5 sentences — the most important insight)
2. KEY CONCEPTS (up to 5 bullet points — what must be remembered)
3. PRACTICAL APPLICATION (one sentence — how this applies to consulting or business)
4. SUGGESTED TAGS (5-8 lowercase tags, comma-separated)

Format clearly. No padding.`
      }], 'claude-sonnet-4-20250514', 0.3)
      return NextResponse.json({ summary })
    }

    // ── Delete ────────────────────────────────────────────────────────────────
    if (action === 'delete') {
      await (supabase as any).from('knowledge_entries').delete()
        .eq('id', body.id as string).eq('user_id', user.id)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
