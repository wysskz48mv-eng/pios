/**
 * /api/academic/research-context — Starter Module (M058)
 * =========================================================
 * GET  — fetch the user's research context (creates default if none)
 * POST — upsert research context fields
 *
 * Used by M059/M060 to personalise relevance scoring and
 * thesis alignment without hardcoded strings.
 *
 * PIOS v3.0 | VeritasIQ Technologies Ltd
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }               from '@/lib/supabase/server'

export const runtime = 'nodejs'

const DEFAULT_CONTEXT = {
  programme:             'DBA',
  research_topic:        'AI-enabled forecasting in Facilities Management (FM), GCC',
  research_question:     'How can AI-enabled forecasting improve lifecycle cost management in GCC FM contexts?',
  keywords:              ['AI forecasting', 'facilities management', 'GCC', 'predictive maintenance', 'lifecycle costing'],
  thesis_synopsis:       'DBA research at the University of Portsmouth examining how AI-enabled forecasting tools can transform lifecycle cost management and decision-making in Facilities Management within Gulf Cooperation Council (GCC) contexts. Research philosophy: pragmatism. Approach: mixed methods, case study strategy.',
  research_philosophy:   'Pragmatism',
  methodology_approach:  'Mixed methods — case study strategy',
  geographic_focus:      'Gulf Cooperation Council (GCC) / MENA',
  industry_focus:        'Facilities Management (FM), Construction',
  theoretical_lens:      'Socio-technical systems, Sensemaking theory, Evidential typology framework',
  preferred_citation_style: 'apa',
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let { data, error } = await supabase
      .from('research_context')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Auto-bootstrap for new users
    if (error && error.code === 'PGRST116') {
      const { data: created, error: createErr } = await supabase
        .from('research_context')
        .insert({ user_id: user.id, ...DEFAULT_CONTEXT })
        .select()
        .single()
      if (createErr) throw createErr
      data  = created
      error = null
    } else if (error) {
      throw error
    }

    return NextResponse.json({ context: data, is_default: !data?.setup_complete })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal error' }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as Record<string, unknown>

    // Whitelist fields that callers may set
    const allowed: (keyof typeof DEFAULT_CONTEXT | 'programme' | 'institution' | 'department' | 'start_year' | 'expected_end_year' | 'supervisor' | 'research_title' | 'sub_questions' | 'excluded_keywords' | 'setup_complete')[] = [
      'programme', 'institution', 'department', 'start_year', 'expected_end_year', 'supervisor',
      'research_title', 'research_topic', 'research_question', 'sub_questions', 'keywords',
      'excluded_keywords', 'thesis_synopsis', 'research_philosophy', 'methodology_approach',
      'geographic_focus', 'industry_focus', 'theoretical_lens', 'preferred_citation_style', 'setup_complete',
    ]

    const payload: Record<string, unknown> = { user_id: user.id }
    for (const key of allowed) {
      if (key in body) payload[key] = body[key]
    }

    if (Object.keys(payload).length <= 1) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    }

    // If all key fields are set, mark setup complete
    if (
      body.research_topic && body.research_question && body.thesis_synopsis &&
      body.keywords && (body.keywords as string[]).length > 0
    ) {
      payload.setup_complete = true
    }

    const { data, error } = await supabase
      .from('research_context')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ ok: true, context: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal error' }, { status: 500 })
  }
}
