/**
 * /api/academic/literature/analyze — Paper Analysis (M060)
 * ==========================================================
 * AI-powered analysis: structured summaries, study quality,
 * thesis alignment, glossary extraction, methodology comparison,
 * Anki flashcard export.
 *
 * PIOS v3.0 | VeritasIQ Technologies Ltd
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }               from '@/lib/supabase/server'
import { callClaude, PIOS_SYSTEM }    from '@/lib/ai/client'

export const runtime = 'nodejs'

const THESIS_CONTEXT_FALLBACK = `DBA research at University of Portsmouth.
Research topic: AI-enabled forecasting in Facilities Management (FM) contexts in the Gulf Cooperation Council (GCC).
Focus areas: predictive maintenance, AI adoption barriers, FM digital transformation, GCC construction sector.
Research philosophy: pragmatism, mixed methods.`

async function getThesisContext(userId: string, supabase: ReturnType<typeof createClient>): Promise<string> {
  try {
    const { data } = await supabase
      .from('research_context')
      .select('thesis_synopsis,research_topic,research_question,keywords,geographic_focus,industry_focus,research_philosophy,methodology_approach,theoretical_lens')
      .eq('user_id', userId)
      .single()
    if (!data) return THESIS_CONTEXT_FALLBACK
    const parts = [
      data.thesis_synopsis,
      data.research_topic ? `Research topic: ${data.research_topic}` : null,
      data.research_question ? `Research question: ${data.research_question}` : null,
      data.geographic_focus ? `Geographic focus: ${data.geographic_focus}` : null,
      data.industry_focus ? `Industry focus: ${data.industry_focus}` : null,
      data.research_philosophy ? `Philosophy: ${data.research_philosophy}` : null,
      data.methodology_approach ? `Methodology: ${data.methodology_approach}` : null,
      data.theoretical_lens ? `Theoretical lens: ${data.theoretical_lens}` : null,
      (data.keywords as string[])?.length > 0 ? `Keywords: ${(data.keywords as string[]).join(', ')}` : null,
    ].filter(Boolean)
    return parts.join('\n')
  } catch {
    return THESIS_CONTEXT_FALLBACK
  }
}

// ── Single-paper analysis ─────────────────────────────────────────────────────
async function analyzePaper(
  title: string,
  abstract: string | null,
  authors: string[],
  year: number | null,
  journal: string | null,
  thesisContext: string,
): Promise<{
  structured_summary: Record<string, unknown>
  study_quality_score: number
  quality_breakdown: Record<string, unknown>
  thesis_alignment_score: number
  thesis_alignment_detail: string
  key_findings: string[]
  methodology_used: string
  research_gaps: string[]
  tokens_estimate: number
}> {
  const prompt = `Analyse this academic paper for a DBA researcher.

THESIS CONTEXT:
${thesisContext}

PAPER:
Title: ${title}
Authors: ${authors.join(', ') || 'Unknown'}
Year: ${year ?? 'Unknown'}
Journal: ${journal ?? 'Unknown'}
Abstract: ${abstract ?? 'No abstract available'}

Provide a structured JSON analysis with these exact fields:
{
  "abstract_summary": "2-3 sentence plain-language summary",
  "key_findings": ["finding 1", "finding 2", "finding 3"],
  "methodology_used": "brief description of research method",
  "research_gaps": ["gap 1", "gap 2"],
  "implications": "how findings affect the field",
  "study_quality_score": 72,
  "quality_breakdown": {
    "methodology_rigor": 75,
    "generalizability": 60,
    "bias_assessment": 70,
    "reproducibility": 65
  },
  "thesis_alignment_score": 85,
  "thesis_alignment_detail": "explain relevance to the DBA thesis topic"
}

Return ONLY the JSON object.`

  const raw = await callClaude(
    [{ role: 'user', content: prompt }],
    PIOS_SYSTEM,
    800,
    'haiku',
  )

  try {
    const match = raw.match(/\{[\s\S]+\}/)
    if (!match) throw new Error('No JSON in response')
    const parsed = JSON.parse(match[0]) as Record<string, unknown>
    return {
      structured_summary: {
        abstract_summary: String(parsed.abstract_summary ?? ''),
        implications:     String(parsed.implications ?? ''),
      },
      study_quality_score:     Number(parsed.study_quality_score ?? 0),
      quality_breakdown:       (parsed.quality_breakdown as Record<string, unknown>) ?? {},
      thesis_alignment_score:  Number(parsed.thesis_alignment_score ?? 0),
      thesis_alignment_detail: String(parsed.thesis_alignment_detail ?? ''),
      key_findings:            (parsed.key_findings as string[]) ?? [],
      methodology_used:        String(parsed.methodology_used ?? ''),
      research_gaps:           (parsed.research_gaps as string[]) ?? [],
      tokens_estimate:         800,
    }
  } catch {
    return {
      structured_summary:     { abstract_summary: raw.slice(0, 500) },
      study_quality_score:    0,
      quality_breakdown:      {},
      thesis_alignment_score: 0,
      thesis_alignment_detail:'Analysis parse error — raw output stored',
      key_findings:           [],
      methodology_used:       '',
      research_gaps:          [],
      tokens_estimate:        800,
    }
  }
}

// ── Glossary extraction ───────────────────────────────────────────────────────
async function extractGlossary(
  title: string,
  abstract: string | null
): Promise<{ term: string; definition: string; context: string }[]> {
  if (!abstract) return []
  const prompt = `Extract 8-12 technical terms from this paper for a research glossary.

PAPER: ${title}
ABSTRACT: ${abstract.slice(0, 1500)}

Return JSON array:
[{"term": "Predictive Maintenance", "definition": "...", "context": "used to describe..."}]

Return ONLY the JSON array.`

  try {
    const raw   = await callClaude([{ role: 'user', content: prompt }], PIOS_SYSTEM, 600, 'haiku')
    const match = raw.match(/\[[\s\S]+\]/)
    if (!match) return []
    return JSON.parse(match[0]) as { term: string; definition: string; context: string }[]
  } catch { return [] }
}

// ── Methodology comparison (multi-paper) ─────────────────────────────────────
async function compareMethodologies(
  papers: { title: string; year: number | null; methodology_used: string; key_findings: string[] }[],
  thesisContext: string,
): Promise<Record<string, unknown>> {
  const prompt = `Compare the research methodologies of these papers.

THESIS CONTEXT: ${thesisContext}

PAPERS:
${papers.map((p, i) => `[${i + 1}] "${p.title}" (${p.year ?? 'n.d.'})
  Method: ${p.methodology_used || 'unknown'}
  Key findings: ${p.key_findings.slice(0, 2).join('; ')}`).join('\n\n')}

Provide a JSON comparison:
{
  "comparison_table": [
    {"paper": "Title", "methodology": "...", "sample_type": "...", "strengths": "...", "limitations": "...", "thesis_relevance": "high|medium|low"}
  ],
  "common_themes": ["theme 1", "theme 2"],
  "methodological_gaps": ["gap 1", "gap 2"],
  "recommended_approach": "Based on the literature, the DBA thesis should..."
}

Return ONLY the JSON object.`

  try {
    const raw   = await callClaude([{ role: 'user', content: prompt }], PIOS_SYSTEM, 1200, 'sonnet')
    const match = raw.match(/\{[\s\S]+\}/)
    if (!match) return { error: 'Parse failed', raw: raw.slice(0, 500) }
    return JSON.parse(match[0]) as Record<string, unknown>
  } catch { return {} }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body   = await req.json() as Record<string, unknown>
    const action = body.action as string

    // ─── action: analyze ──────────────────────────────────────────────────────
    if (action === 'analyze') {
      const literatureId = body.literature_id as string
      if (!literatureId) return NextResponse.json({ error: 'literature_id required' }, { status: 400 })

      const { data: lit, error: litErr } = await supabase
        .from('academic_literature')
        .select('*')
        .eq('id', literatureId)
        .eq('user_id', user.id)
        .single()
      if (litErr || !lit) return NextResponse.json({ error: 'Paper not found' }, { status: 404 })

      // Pull user's research context for personalised thesis alignment
      const thesisContext = await getThesisContext(user.id, supabase)

      // Run analysis + glossary in parallel
      const [analysis, glossaryItems] = await Promise.all([
        analyzePaper(
          lit.title as string,
          lit.abstract as string | null,
          (lit.authors as string[]) ?? [],
          lit.year as number | null,
          lit.journal as string | null,
          thesisContext,
        ),
        extractGlossary(lit.title as string, lit.abstract as string | null),
      ])

      // Upsert analysis
      const { data: savedAnalysis, error: saveErr } = await supabase
        .from('paper_analysis')
        .upsert({
          user_id:                user.id,
          literature_id:          literatureId,
          structured_summary:     analysis.structured_summary,
          study_quality_score:    analysis.study_quality_score,
          quality_breakdown:      analysis.quality_breakdown,
          thesis_alignment_score: analysis.thesis_alignment_score,
          thesis_alignment_detail:analysis.thesis_alignment_detail,
          key_findings:           analysis.key_findings,
          methodology_used:       analysis.methodology_used,
          research_gaps:          analysis.research_gaps,
          model_used:             'claude-haiku',
          tokens_used:            analysis.tokens_estimate,
        }, { onConflict: 'user_id,literature_id' })
        .select()
        .single()
      if (saveErr) throw saveErr

      // Save glossary (delete + insert for this paper)
      if (glossaryItems.length > 0) {
        await supabase.from('paper_glossary').delete().eq('literature_id', literatureId).eq('user_id', user.id)
        await supabase.from('paper_glossary').insert(
          glossaryItems.map(g => ({ user_id: user.id, literature_id: literatureId, ...g }))
        )
      }

      return NextResponse.json({
        ok: true,
        analysis:  savedAnalysis,
        glossary:  glossaryItems,
        cost_usd:  Number((analysis.tokens_estimate * 0.00000025).toFixed(6)),
      })
    }

    // ─── action: compare ──────────────────────────────────────────────────────
    if (action === 'compare') {
      const ids = (body.literature_ids as string[]) ?? []
      if (ids.length < 2) return NextResponse.json({ error: 'Provide at least 2 literature_ids' }, { status: 400 })

      // Fetch analysis records already saved
      const { data: analyses } = await supabase
        .from('paper_analysis')
        .select('literature_id, methodology_used, key_findings')
        .eq('user_id', user.id)
        .in('literature_id', ids)

      const { data: papers } = await supabase
        .from('academic_literature')
        .select('id, title, year')
        .eq('user_id', user.id)
        .in('id', ids)

      const analysisMap = new Map((analyses ?? []).map(a => [a.literature_id as string, a]))
      const payload = (papers ?? []).map(p => ({
        title:            p.title as string,
        year:             p.year as number | null,
        methodology_used: (analysisMap.get(p.id as string) as Record<string, unknown>)?.methodology_used as string ?? '',
        key_findings:     (analysisMap.get(p.id as string) as Record<string, unknown>)?.key_findings as string[] ?? [],
      }))

      const comparison = await compareMethodologies(payload, await getThesisContext(user.id, supabase))

      // Save to a batch record
      const batchName = body.batch_name as string ?? `Comparison — ${new Date().toLocaleDateString()}`
      await supabase.from('analysis_batch').insert({
        user_id:               user.id,
        name:                  batchName,
        literature_ids:        ids,
        status:                'complete',
        methodology_comparison:comparison,
        total_papers:          ids.length,
        completed_papers:      ids.length,
        started_at:            new Date().toISOString(),
        completed_at:          new Date().toISOString(),
      })

      return NextResponse.json({ ok: true, comparison, papers_compared: ids.length })
    }

    // ─── action: anki ─────────────────────────────────────────────────────────
    if (action === 'anki') {
      const ids = (body.literature_ids as string[]) ?? []
      let q = supabase.from('paper_glossary').select('term, definition, context').eq('user_id', user.id)
      if (ids.length > 0) q = q.in('literature_id', ids)

      const { data, error } = await q.limit(500)
      if (error) throw error

      const rows = (data ?? []) as { term: string; definition: string; context?: string }[]
      // Build Anki-compatible CSV (tab-separated: front\tback)
      const csv = rows
        .map(r => `${r.term.replace(/\t/g, ' ')}\t${r.definition.replace(/\t/g, ' ')}${r.context ? ' (Context: ' + r.context.replace(/\t/g, ' ') + ')' : ''}`)
        .join('\n')

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="pios_glossary_anki_${Date.now()}.txt"`,
        },
      })
    }

    // ─── action: get_glossary ─────────────────────────────────────────────────
    if (action === 'get_glossary') {
      const literatureId = body.literature_id as string | undefined
      let q = supabase.from('paper_glossary').select('*').eq('user_id', user.id).order('term')
      if (literatureId) q = q.eq('literature_id', literatureId)

      const { data, error } = await q.limit(500)
      if (error) throw error
      return NextResponse.json({ glossary: data ?? [], total: (data ?? []).length })
    }

    // ─── action: get_batches ──────────────────────────────────────────────────
    if (action === 'get_batches') {
      const { data, error } = await supabase
        .from('analysis_batch')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return NextResponse.json({ batches: data ?? [] })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal error' }, { status: 500 })
  }
}
