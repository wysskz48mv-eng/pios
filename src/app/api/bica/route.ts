/**
 * /api/bica — BICA™ Board & Investor Comms Agent
 * Generates: board updates, investor letters, CEO memos, strategy comms
 * PIOS Sprint 24 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'

export const runtime    = 'nodejs'
export const maxDuration = 60

const TEMPLATES = {
  board_update: {
    label: 'Board Update',
    desc:  'Monthly or quarterly board pack narrative',
    sections: ['Executive Summary','Performance vs OKRs','Financial Headlines','Key Decisions Made','Risks & Mitigations','Strategic Priorities Next Period','Requests from Board'],
  },
  investor_update: {
    label: 'Investor Update',
    desc:  'Regular investor communication (VC, angel, or PE)',
    sections: ['Executive Summary','Highlights This Period','Metrics Dashboard','Challenges & How We\'re Addressing Them','Team Updates','Capital & Runway','Ask / Next Steps'],
  },
  ceo_letter: {
    label: 'CEO Letter',
    desc:  'Leadership narrative for annual report or major milestone',
    sections: ['Opening Reflection','Year / Period in Review','Strategic Progress','People & Culture','Looking Forward','Closing'],
  },
  stakeholder_report: {
    label: 'Stakeholder Report',
    desc:  'Broader stakeholder communication (partners, clients, community)',
    sections: ['Overview','Progress Against Commitments','Key Outcomes','Challenges Encountered','Priorities Ahead','How Stakeholders Can Support'],
  },
  strategy_memo: {
    label: 'Strategy Memo',
    desc:  'Internal strategic communication to leadership team',
    sections: ['Context & Purpose','Current Situation Assessment','Strategic Direction','Priorities & Trade-offs','What We Need From the Team','Next Steps & Timeline'],
  },
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    if (searchParams.get('mode') === 'templates') {
      return NextResponse.json({ templates: Object.entries(TEMPLATES).map(([key, t]) => ({ key, ...t })) })
    }

    const { data: comms } = await supabase
      .from('bica_comms').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false })

    return NextResponse.json({ comms: comms ?? [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles').select('tenant_id,full_name,job_title,organisation').eq('id', user.id).single()
    const prof = profile as Record<string,unknown> | null

    const body = await req.json()
    const { action } = body as { action: string }

    // ── Generate comms ───────────────────────────────────────
    if (action === 'generate') {
      const { comms_type, audience, period, tone, inputs } = body as {
        comms_type: string; audience: string; period: string
        tone: string; inputs: Record<string,string>
      }

      const template = TEMPLATES[comms_type as keyof typeof TEMPLATES]
      if (!template) return NextResponse.json({ error: 'Unknown comms type' }, { status: 400 })

      // Fetch live OKR data to ground the output
      const { data: okrs } = await supabase
        .from('exec_okrs').select('title,health,progress,period')
        .eq('user_id', user.id).eq('status', 'active')

      const okrContext = okrs?.length
        ? `\nLIVE OKR STATE:\n${(okrs as Record<string,unknown>[]).map(o => `- ${o.title}: ${o.progress}% (${o.health})`).join('\n')}`
        : ''

      const inputsFormatted = Object.entries(inputs)
        .filter(([, v]) => v?.trim())
        .map(([k, v]) => `${k.replace(/_/g,' ').toUpperCase()}: ${v}`)
        .join('\n\n')

      const systemPrompt = `You are BICA™ — the Board & Investor Comms Agent inside PIOS, writing on behalf of ${(prof?.full_name as string) ?? 'the CEO'} (${(prof?.job_title as string) ?? 'CEO'} of ${(prof?.organisation as string) ?? 'the organisation'}).

You write executive communications that are: clear, confident, and free of jargon. You match the specified tone precisely. You never include AI disclaimers or meta-commentary. You write as the executive, in the first person where appropriate.

TONE GUIDE:
- formal: measured, professional, traditional board language
- confident: assertive, positive framing, forward-looking
- balanced: honest about challenges, credible about solutions
- direct: short sentences, action-oriented, no padding`

      const userPrompt = `Write a ${template.label} for ${(prof?.organisation as string) ?? 'the organisation'}.

AUDIENCE: ${audience || 'Board of Directors'}
PERIOD: ${period || 'current quarter'}
TONE: ${tone}
${okrContext}

INPUTS PROVIDED:
${inputsFormatted || 'No specific inputs provided — use professional judgment based on the context.'}

Structure the communication using these sections:
${template.sections.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Guidelines:
- Write in full, publication-ready prose — not bullet fragments
- Each section should be 1-3 paragraphs
- Be specific where inputs are provided; use credible professional language where they are not
- The total length should be appropriate for the audience — board updates: 400-600 words; investor updates: 350-500 words; CEO letters: 500-700 words; memos: 300-450 words`

      const content = await callClaude(
        [{ role: 'user', content: userPrompt }],
        systemPrompt,
        1400
      )

      const wordCount = content.split(/\s+/).length

      // Persist
      const { data: saved } = await supabase.from('bica_comms').insert({
        user_id:     user.id,
        tenant_id: prof?.tenant_id ?? user.id,
        title:       `${template.label} — ${period || new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`,
        comms_type,
        audience,
        period,
        tone,
        inputs_json: inputs,
        content,
        status:      'draft',
        word_count:  wordCount,
      }).select().single()

      return NextResponse.json({ content, word_count: wordCount, id: (saved as Record<string,unknown> | null)?.id })
    }

    // ── Update status ────────────────────────────────────────
    if (action === 'update_status') {
      const { id, status } = body as { id: string; status: string }
      const { data } = await supabase.from('bica_comms')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id).eq('user_id', user.id)
        .select().single()
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
