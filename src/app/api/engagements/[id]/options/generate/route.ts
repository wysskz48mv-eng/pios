import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireOwnedEngagement, cleanStringArray } from '@/app/api/fm/_shared'
import { callClaude } from '@/lib/ai/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string }

type ParsedOption = {
  title?: string
  description?: string
  pros?: unknown
  cons?: unknown
  cost_min?: number
  cost_max?: number
  implementation_time_weeks?: number
  risk_level?: 'low' | 'medium' | 'high'
  recommended?: boolean
  recommendation_reasoning?: string
  is_recommended?: boolean
}

function parseJson(raw: string): unknown {
  const clean = raw.replace(/```json\n?|```\n?/g, '').trim()
  try {
    return JSON.parse(clean)
  } catch {
    const startArr = clean.indexOf('[')
    const endArr = clean.lastIndexOf(']')
    if (startArr >= 0 && endArr > startArr) return JSON.parse(clean.slice(startArr, endArr + 1))

    const startObj = clean.indexOf('{')
    const endObj = clean.lastIndexOf('}')
    if (startObj >= 0 && endObj > startObj) return JSON.parse(clean.slice(startObj, endObj + 1))

    throw new Error('AI response did not contain valid JSON')
  }
}

function normalizeOptions(parsed: unknown): { options: ParsedOption[]; recommendationReasoning?: string } {
  if (Array.isArray(parsed)) return { options: parsed as ParsedOption[] }

  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    const options = Array.isArray(obj.options) ? (obj.options as ParsedOption[]) : []
    const recommendationReasoning =
      typeof obj.recommendation_reasoning === 'string' ? obj.recommendation_reasoning : undefined

    if (options.length) return { options, recommendationReasoning }
  }

  return { options: [] }
}

export async function POST(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { id } = await context.params
    const auth = await requireOwnedEngagement(req, id)
    if ('error' in auth) return auth.error

    const { admin, tenantId, engagement } = auth

    const body = (await req.json().catch(() => ({}))) as {
      objectives?: string
      context?: Record<string, unknown>
    }

    const [{ data: fmType }, { data: frameworkRuns }, { data: riskItems }] = await Promise.all([
      engagement.fm_engagement_type_code
        ? admin
            .from('fm_engagement_types')
            .select('*')
            .eq('type_code', engagement.fm_engagement_type_code)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from('engagement_frameworks')
        .select('step_number,framework_code,output,created_at')
        .eq('engagement_id', id)
        .order('created_at', { ascending: false })
        .limit(25),
      admin
        .from('engagement_risks')
        .select('custom_title,custom_description,risk_library:fm_risk_library(title,description)')
        .eq('engagement_id', id)
        .order('risk_score', { ascending: false })
        .limit(10),
    ])

    const frameworkOutputs = (frameworkRuns ?? []).map((run) => ({
      step: run.step_number,
      framework: run.framework_code,
      output: run.output,
    }))

    const prompt = `You are an FM consultant generating strategic options for an engagement.

Engagement: ${engagement.title}
Type: ${fmType?.name ?? engagement.fm_engagement_type_code ?? engagement.engagement_type}
Client Context: ${engagement.client_name}, ${engagement.industry_sector ?? 'n/a'}, ${engagement.building_type ?? 'n/a'}
Objectives: ${body.objectives ?? engagement.brief ?? 'No explicit objectives provided'}

Completed frameworks:
${JSON.stringify(frameworkOutputs, null, 2)}

Known risks:
${JSON.stringify(riskItems ?? [], null, 2)}

Generate 3-4 distinct strategic options that:
1. Are mutually exclusive and collectively exhaustive (MECE)
2. Range from conservative to transformational
3. Include realistic cost estimates and timelines
4. Identify implementation risks
5. Align with ISO 41001 and ISO 55001 principles

For each option provide:
- title
- description (2-3 sentences)
- pros (3-5 bullet points)
- cons (3-5 bullet points)
- cost_min and cost_max in GBP
- implementation_time_weeks
- risk_level (low|medium|high)
- is_recommended (boolean)
- recommendation_reasoning

Return JSON as either:
- array of options, OR
- { "options": [...], "recommendation_reasoning": "..." }`

    const raw = await callClaude([{ role: 'user', content: prompt }], 'Return valid JSON only.', 2200, 'sonnet')
    const parsed = parseJson(raw)
    const normalized = normalizeOptions(parsed)

    const generated = normalized.options
      .filter((opt) => opt && typeof opt === 'object')
      .slice(0, 4)
      .map((opt, idx) => ({
        tenant_id: tenantId,
        engagement_id: id,
        option_number: idx + 1,
        title: String(opt.title ?? `Option ${idx + 1}`),
        description: String(opt.description ?? 'No description provided.'),
        pros: cleanStringArray(opt.pros),
        cons: cleanStringArray(opt.cons),
        estimated_cost_min: Number.isFinite(Number(opt.cost_min)) ? Number(opt.cost_min) : null,
        estimated_cost_max: Number.isFinite(Number(opt.cost_max)) ? Number(opt.cost_max) : null,
        implementation_time_weeks: Number.isFinite(Number(opt.implementation_time_weeks))
          ? Number(opt.implementation_time_weeks)
          : null,
        risk_level:
          opt.risk_level && ['low', 'medium', 'high'].includes(opt.risk_level)
            ? opt.risk_level
            : 'medium',
        is_recommended: Boolean(opt.is_recommended ?? opt.recommended ?? false),
        recommendation_reasoning:
          typeof opt.recommendation_reasoning === 'string'
            ? opt.recommendation_reasoning
            : normalized.recommendationReasoning ?? null,
      }))

    if (generated.length < 3) {
      return NextResponse.json(
        {
          error: 'AI generation returned insufficient options',
          raw,
        },
        { status: 502 }
      )
    }

    if (!generated.some((option) => option.is_recommended)) {
      generated[0].is_recommended = true
      generated[0].recommendation_reasoning =
        generated[0].recommendation_reasoning ?? 'Selected as baseline recommendation pending further stakeholder review.'
    }

    // Replace previous generated options for a clean comparison set.
    await admin.from('fm_options').delete().eq('engagement_id', id)

    const { data, error } = await admin
      .from('fm_options')
      .insert(generated)
      .select('*')
      .order('option_number', { ascending: true })

    if (error) throw error

    return NextResponse.json({ options: data ?? [], generated_count: generated.length })
  } catch (err: unknown) {
    return apiError(err)
  }
}
