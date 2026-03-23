import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/literature                — list items (filterable)
// POST { action:'update', id, ... }   — update read_status, relevance, notes
// POST { action:'delete', id }        — delete item
// POST { action:'ai_summary', id }    — generate AI summary + APA citation
// POST { action:'export' }            — export all as BibTeX / APA list
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const readStatus  = searchParams.get('read_status')
    const sourceType  = searchParams.get('source_type')
    const tag         = searchParams.get('tag')
    const search      = searchParams.get('q')

    let q = supabase.from('literature_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (readStatus && readStatus !== 'all') q = q.eq('read_status', readStatus)
    if (sourceType && sourceType !== 'all') q = q.eq('source_type', sourceType)
    if (tag) q = q.contains('tags', [tag])
    if (search) q = q.or(`title.ilike.%${search}%,journal.ilike.%${search}%,notes.ilike.%${search}%`)

    const { data, error } = await q.limit(100)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Aggregate stats
    const all = data ?? []
    const stats = {
      total:   all.length,
      unread:  all.filter(i => i.read_status === 'unread').length,
      reading: all.filter(i => i.read_status === 'reading').length,
      read:    all.filter(i => i.read_status === 'read').length,
      revisit: all.filter(i => i.read_status === 'revisit').length,
      byType:  all.reduce((acc: Record<string,number>, i) => { acc[i.source_type] = (acc[i.source_type]||0)+1; return acc }, {}),
    }

    return NextResponse.json({ items: all, stats })
  } catch (err: unknown) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { action } = body

    // ── Create item ──────────────────────────────────────────────────────────
    if (action === 'create') {
      const { title, authors, year, journal, doi, url, source_type, notes, tags } = body
      if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })
      const { data: profile } = await supabase.from('user_profiles').select('tenant_id').eq('id', user.id).single()
      const { data, error } = await supabase.from('literature_items').insert({
        user_id:     user.id,
        tenant_id:   profile?.tenant_id,
        title:       title.trim(),
        authors:     Array.isArray(authors) ? authors : [],
        year:        year ? parseInt(year) : null,
        journal:     journal  || null,
        doi:         doi      || null,
        url:         url      || null,
        source_type: source_type || 'journal',
        notes:       notes    || null,
        tags:        Array.isArray(tags) ? tags : [],
        read_status: 'unread',
        updated_at:  new Date().toISOString(),
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ item: data }, { status: 201 })
    }

    // ── Update item ───────────────────────────────────────────────────────────
    if (action === 'update') {
      const { id, ...updates } = body
      delete updates.action
      delete updates.user_id
      const { error } = await supabase.from('literature_items')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id).eq('user_id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ updated: true })
    }

    // ── Delete item ───────────────────────────────────────────────────────────
    if (action === 'delete') {
      await supabase.from('literature_items').delete()
        .eq('id', body.id).eq('user_id', user.id)
      return NextResponse.json({ deleted: true })
    }

    // ── Generate AI summary + APA citation ───────────────────────────────────
    if (action === 'ai_summary') {
      const { id } = body
      const { data: item } = await supabase.from('literature_items')
        .select('*').eq('id', id).eq('user_id', user.id).single()
      if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

      const system = `You are an academic research assistant helping Douglas Masuku, a DBA candidate at the University of Portsmouth researching AI-enabled forecasting in GCC facilities management using STS theory and Weick's sensemaking framework.

Generate a structured academic summary of the given paper/source. Return ONLY valid JSON:
{
  "summary": "3-4 sentence summary of the key arguments, methods, and findings",
  "relevance_to_dba": "2-3 sentences on how this source relates to Douglas's DBA research on AI-FM adoption in GCC",
  "key_concepts": ["concept1", "concept2", "concept3"],
  "theoretical_contribution": "One sentence on what theoretical lens or contribution this makes",
  "citation_apa": "Full APA 7th edition citation",
  "citation_bibtex": "@article{key,\\n  ...\\n}",
  "suggested_themes": ["theme1", "theme2"],
  "suggested_relevance_score": 1-5
}`

      const authorStr = Array.isArray(item.authors) ? item.authors.join(', ') : (item.authors ?? 'Unknown')
      const prompt = `Generate academic summary for:
Title: ${item.title}
Authors: ${authorStr}
Year: ${item.year ?? 'n.d.'}
Journal/Source: ${item.journal ?? item.source_type}
DOI: ${item.doi ?? 'not available'}
Existing notes: ${item.notes ?? 'none'}
Tags: ${item.tags?.join(', ') ?? 'none'}`

      const raw = await callClaude([{ role: 'user', content: prompt }], system, 1000)
      let parsed: any = {}
      try {
        parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
      } catch {
        return NextResponse.json({ error: 'AI summary parsing failed' }, { status: 500 })
      }

      // Run citation guard on the item itself
      let guardResult = null
      if (item.doi || item.url) {
        try {
          const { verifyCitations } = await import('@/lib/citation-guard')
          const report = await verifyCitations([{
            title:   item.title,
            authors: Array.isArray(item.authors) ? item.authors : [],
            year:    item.year,
            journal: item.journal,
            doi:     item.doi,
            url:     item.url,
          }])
          guardResult = report.results[0]
          // Override AI-generated APA citation confidence with verified data
          if (guardResult?.crossref_title && guardResult.title_match === 'mismatch') {
            parsed.citation_apa += ` [⚠ Title mismatch — CrossRef records: "${guardResult.crossref_title}"]`
          }
          if (guardResult?.requires_hitl) {
            parsed.citation_apa += ` [NEEDS MANUAL VERIFICATION]`
          }
        } catch { /* guard non-fatal */ }
      }

      // Save back to DB
      await supabase.from('literature_items').update({
        ai_summary:   parsed.summary,
        citation_apa: parsed.citation_apa,
        themes:       parsed.suggested_themes ?? [],
        relevance:    parsed.suggested_relevance_score ?? item.relevance,
        updated_at:   new Date().toISOString(),
      }).eq('id', id).eq('user_id', user.id)

      return NextResponse.json({ ...parsed, saved: true })
    }

    // ── Export all as APA list or BibTeX ─────────────────────────────────────
    if (action === 'export') {
      const { format = 'apa' } = body
      const { data: items } = await supabase.from('literature_items')
        .select('*').eq('user_id', user.id)
        .not('citation_apa', 'is', null)
        .order('authors')

      if (!items?.length) return NextResponse.json({ export: '', count: 0 })

      if (format === 'apa') {
        const list = items
          .filter(i => i.citation_apa)
          .map(i => i.citation_apa)
          .join('\n\n')
        return NextResponse.json({ export: list, count: items.length, format: 'apa' })
      }

      // BibTeX — generate from fields if no stored bibtex
      const bibtex = items.map(i => {
        const key = `${(Array.isArray(i.authors) ? i.authors[0] : 'Unknown').split(',')[0].toLowerCase().replace(/\s/g,'')}${i.year ?? 'nd'}`
        const authors = Array.isArray(i.authors) ? i.authors.join(' and ') : (i.authors ?? 'Unknown')
        return `@article{${key},\n  author={${authors}},\n  title={${i.title}},\n  journal={${i.journal ?? 'Unknown'}},\n  year={${i.year ?? 'n.d.'}},\n  doi={${i.doi ?? ''}}\n}`
      }).join('\n\n')
      return NextResponse.json({ export: bibtex, count: items.length, format: 'bibtex' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    console.error('/api/literature:', err)
    return NextResponse.json({ error: err.message ?? 'Request failed' }, { status: 500 })
  }
}
