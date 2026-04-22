import { callClaude } from '@/lib/ai/client'
import { createServiceClient } from '@/lib/supabase/server'

export interface EngagementReportData {
  engagement: {
    title: string
    client_name: string
    type: string
    start_date: string
    objectives: string[]
  }
  executive_summary: string
  steps: {
    step_number: number
    step_name: string
    frameworks: Array<{
      name: string
      output: unknown
    }>
    confidence: string
  }[]
  risks: Array<{
    code: string
    title: string
    probability: string
    impact: string
    score: number
    mitigation: string
  }>
  options: Array<{
    title: string
    description: string
    pros: string[]
    cons: string[]
    cost_range: string
    recommended: boolean
  }>
  recommendations: string
}

const STEP_NAMES: Record<number, string> = {
  1: 'Define',
  2: 'Structure',
  3: 'Prioritize',
  4: 'Plan',
  5: 'Analyze',
  6: 'Synthesize',
  7: 'Recommend',
}

function truncateText(value: unknown, max = 300) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '')
  if (text.length <= max) return text
  return `${text.slice(0, max - 3)}...`
}

function parseObjectives(brief: string | null | undefined): string[] {
  if (!brief) return ['Deliver an actionable FM engagement outcome.']
  const lines = brief
    .split(/\n|\.|;/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)
  return lines.length ? lines : ['Deliver an actionable FM engagement outcome.']
}

async function aiOrFallback(args: {
  system: string
  prompt: string
  model: 'haiku' | 'sonnet'
  fallback: string
  maxTokens?: number
}) {
  try {
    const response = await callClaude(
      [{ role: 'user', content: args.prompt }],
      args.system,
      args.maxTokens ?? 700,
      args.model
    )
    const cleaned = response.trim()
    return cleaned.length ? cleaned : args.fallback
  } catch {
    return args.fallback
  }
}

export async function buildReportData(engagementId: string): Promise<EngagementReportData> {
  const db = createServiceClient()

  const [{ data: engagement }, { data: steps }, { data: frameworkRuns }, { data: risks }, { data: options }] =
    await Promise.all([
      db.from('consulting_engagements').select('*').eq('id', engagementId).maybeSingle(),
      db.from('engagement_steps').select('*').eq('engagement_id', engagementId).order('step_number', { ascending: true }),
      db
        .from('engagement_frameworks')
        .select('step_number,framework_code,output,created_at')
        .eq('engagement_id', engagementId)
        .order('created_at', { ascending: false }),
      db
        .from('engagement_risks')
        .select('probability,impact,risk_score,mitigation_plan,custom_title,risk_library:fm_risk_library(risk_code,title)')
        .eq('engagement_id', engagementId)
        .order('risk_score', { ascending: false }),
      db.from('fm_options').select('*').eq('engagement_id', engagementId).order('option_number', { ascending: true }),
    ])

  if (!engagement) throw new Error('Engagement not found for report generation')

  const structuredSteps = (steps ?? []).map((step) => {
    const stepNumber = Number(step.step_number)
    const runs = (frameworkRuns ?? [])
      .filter((run) => Number(run.step_number) === stepNumber)
      .slice(0, 4)
      .map((run) => ({
        name: run.framework_code,
        output: run.output,
      }))

    return {
      step_number: stepNumber,
      step_name: STEP_NAMES[stepNumber] ?? `Step ${stepNumber}`,
      frameworks: runs,
      confidence: step.confidence_score == null ? 'n/a' : `${Math.round(Number(step.confidence_score) * 100)}%`,
    }
  })

  const structuredRisks = (risks ?? []).map((risk) => {
    const library = Array.isArray(risk.risk_library) ? risk.risk_library[0] : risk.risk_library
    return {
      code: library?.risk_code ?? 'CUSTOM',
      title: library?.title ?? risk.custom_title ?? 'Untitled risk',
      probability: risk.probability,
      impact: risk.impact,
      score: Number(risk.risk_score ?? 0),
      mitigation: truncateText(risk.mitigation_plan ?? 'Mitigation plan pending', 220),
    }
  })

  const structuredOptions = (options ?? []).map((option) => ({
    title: option.title,
    description: option.description,
    pros: Array.isArray(option.pros) ? option.pros.slice(0, 6) : [],
    cons: Array.isArray(option.cons) ? option.cons.slice(0, 6) : [],
    cost_range: `£${Number(option.estimated_cost_min ?? 0).toLocaleString()} - £${Number(option.estimated_cost_max ?? 0).toLocaleString()}`,
    recommended: Boolean(option.is_recommended),
  }))

  const fallbackSummary = `This report covers ${engagement.title} for ${engagement.client_name}. It consolidates workbench outputs, risk posture, and strategic options to support a decision-ready recommendation.`

  const executive_summary = await aiOrFallback({
    system:
      'You are a senior FM consultant. Write concise executive summaries grounded in provided evidence only. 160-220 words, UK English.',
    prompt: `Generate an executive summary (around 200 words).\n\nEngagement:\n${JSON.stringify(
      {
        title: engagement.title,
        client_name: engagement.client_name,
        type: engagement.fm_engagement_type_code ?? engagement.engagement_type,
        objectives: parseObjectives(engagement.brief),
      },
      null,
      2
    )}\n\nSteps:\n${JSON.stringify(structuredSteps, null, 2)}\n\nTop risks:\n${JSON.stringify(structuredRisks.slice(0, 8), null, 2)}\n\nOptions:\n${JSON.stringify(structuredOptions, null, 2)}`,
    model: 'sonnet',
    fallback: fallbackSummary,
    maxTokens: 800,
  })

  const fallbackRecommendations =
    structuredOptions.find((option) => option.recommended)?.description ??
    'Prioritise the lowest-risk option with strongest alignment to business objectives and immediate compliance obligations.'

  const recommendations = await aiOrFallback({
    system:
      'You are a facilities management strategy advisor. Produce practical recommendations with clear sequencing and risk controls.',
    prompt: `Provide final recommendations in 4-7 bullet points. Include decision rationale, immediate next actions, and risk controls.\n\nData:\n${JSON.stringify(
      {
        objectives: parseObjectives(engagement.brief),
        top_risks: structuredRisks.slice(0, 10),
        options: structuredOptions,
      },
      null,
      2
    )}`,
    model: 'sonnet',
    fallback: fallbackRecommendations,
    maxTokens: 700,
  })

  return {
    engagement: {
      title: engagement.title ?? 'Untitled engagement',
      client_name: engagement.client_name ?? 'Client',
      type: engagement.fm_engagement_type_code ?? engagement.engagement_type ?? 'fm',
      start_date: engagement.start_date ?? new Date().toISOString().slice(0, 10),
      objectives: parseObjectives(engagement.brief),
    },
    executive_summary,
    steps: structuredSteps,
    risks: structuredRisks,
    options: structuredOptions,
    recommendations,
  }
}
