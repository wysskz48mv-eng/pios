/**
 * POST /api/literature/gap-analysis
 * AI-powered literature gap analysis — identifies research gaps,
 * suggests next sources to find, and maps coverage to thesis chapters.
 * PIOS v2.2 | Sprint 26
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }               from '@/lib/supabase/server'
import { callClaude, AIMessage }      from '@/lib/ai/client'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { chapter_focus, additional_context } = body

  // Fetch all literature items for this user
  const { data: items, error } = await supabase
    .from('literature_items')
    .select('id,title,authors,year,publication_type,tags,notes,relevance_score,read_status')
    .eq('user_id', user.id)
    .order('year', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: (error as Error).message }, { status: 500 })

  // Fetch thesis chapters for context
  const { data: chapters } = await supabase
    .from('thesis_chapters')
    .select('chapter_num,title,status')
    .eq('user_id', user.id)
    .order('chapter_num')

  const litSummary = (items ?? []).map(i =>
    `- ${i.year ?? '?'}: ${i.title ?? 'Untitled'} (${i.authors ?? 'Unknown'}) [${i.publication_type ?? 'article'}] — relevance: ${i.relevance_score ?? '?'}/10`
  ).join('\n')

  const chapSummary = (chapters ?? []).map(c =>
    `Ch${(c as any)?.chapter_num}: ${(c as any)?.title ?? 'Untitled'} [${(c as any)?.status}]`
  ).join(', ')

  const prompt = [
    `You are an expert academic supervisor conducting a literature review gap analysis.`,
    ``,
    `THESIS CHAPTERS: ${chapSummary || 'Not yet defined'}`,
    chapter_focus ? `FOCUS AREA: ${chapter_focus}` : '',
    additional_context ? `ADDITIONAL CONTEXT: ${additional_context}` : '',
    ``,
    `CURRENT LITERATURE (${(items ?? []).length} items):`,
    litSummary || '(No literature items added yet)',
    ``,
    `Provide a structured gap analysis as JSON with this exact structure:`,
    `{`,
    `  "coverage_score": <0-100 integer — overall literature coverage>,`,
    `  "gaps": [{ "area": "<gap area>", "severity": "critical|major|minor", "description": "<why this gap matters>", "suggested_search_terms": ["term1","term2"] }],`,
    `  "chapter_coverage": [{ "chapter": "<Ch1: title>", "coverage": "well-covered|partial|gap", "missing": "<what is missing>" }],`,
    `  "suggested_sources": [{ "type": "journal|book|report|thesis", "suggestion": "<specific recommended source or search>", "rationale": "<why this would help>" }],`,
    `  "strengths": ["<strength1>","<strength2>"],`,
    `  "priority_actions": ["<action1>","<action2>","<action3>"]`,
    `}`,
    `Return ONLY the JSON object. No markdown, no preamble.`,
  ].filter(Boolean).join('\n')

  try {
    const raw = await callClaude([{ role: 'user', content: prompt }], 'You are an expert academic supervisor.', 2000)
    const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim()
    let parsed: unknown
    try { parsed = JSON.parse(clean) } catch {
      return NextResponse.json({ error: 'AI parse failed', raw: clean.slice(0, 300) }, { status: 500 })
    }
    return NextResponse.json({ ok: true, literature_count: (items ?? []).length, analysis: parsed })
  } catch (e: unknown) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 })
  }
}
