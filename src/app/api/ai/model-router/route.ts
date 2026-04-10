/**
 * GET  /api/ai/model-router  — current model routing config
 * POST /api/ai/model-router  — update routing config or test a route
 *   actions: save | test | benchmark
 *
 * Allows users to configure which Claude model handles which PIOS task:
 *   - Sonnet 4   : complex reasoning tasks (NemoClaw, viva, analysis)
 *   - Haiku 4.5  : quick tasks (summaries, classification, tagging)
 *   - Sonnet 4.5 : balanced (meetings, literature, notifications)
 *
 * PIOS™ v3.3.0 | Sprint G — AI Model Routing | VeritasIQ Technologies Ltd
 */
import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { completeWithFailover }      from '@/lib/ai/provider'

export const dynamic = 'force-dynamic'

// ── Available models + capabilities ──────────────────────────────────────────
const MODELS: Record<string, { label:string; tier:string; speed:string; cost:string; best_for:string; token_limit:number; colour:string }> = {
  'claude-opus-4-5': {
    label:      'Claude Opus 4.5',
    tier:       'premium',
    speed:      'slow',
    cost:       'highest',
    best_for:   'Complex multi-step reasoning, strategic analysis, DBA research synthesis',
    token_limit: 200000,
    colour:     '#7c3aed',
  },
  'claude-sonnet-4-20250514': {
    label:      'Claude Sonnet 4',
    tier:       'standard',
    speed:      'medium',
    cost:       'medium',
    best_for:   'NemoClaw calibration, viva preparation, meeting intelligence, literature analysis',
    token_limit: 200000,
    colour:     '#2563eb',
  },
  'claude-haiku-4-5-20251001': {
    label:      'Claude Haiku 4.5',
    tier:       'fast',
    speed:      'fastest',
    cost:       'lowest',
    best_for:   'Quick summaries, tagging, classification, notification drafts, short tasks',
    token_limit: 200000,
    colour:     '#059669',
  },
}

// ── Default routing config ────────────────────────────────────────────────────
const DEFAULT_ROUTES: Record<string, { model: string; rationale: string }> = {
  nemoclaw:       { model: 'claude-sonnet-4-20250514',   rationale: 'Calibration + persona injection requires deep reasoning' },
  viva:           { model: 'claude-sonnet-4-20250514',   rationale: 'Examiner simulation requires nuanced academic understanding' },
  meetings:       { model: 'claude-sonnet-4-20250514',   rationale: 'Decision/risk extraction needs careful reasoning' },
  literature:     { model: 'claude-sonnet-4-20250514',   rationale: 'Academic literature synthesis requires depth' },
  notifications:  { model: 'claude-haiku-4-5-20251001',  rationale: 'Short notification drafts suit fast model' },
  tasks:          { model: 'claude-haiku-4-5-20251001',  rationale: 'Task classification and tagging are simple tasks' },
  insights:       { model: 'claude-haiku-4-5-20251001',  rationale: 'Insight capture summaries are lightweight' },
  chief_of_staff: { model: 'claude-sonnet-4-20250514',   rationale: 'CoS briefings require strategic synthesis' },
  research:       { model: 'claude-opus-4-5',            rationale: 'Deep research synthesis benefits from Opus reasoning' },
  financial:      { model: 'claude-sonnet-4-20250514',   rationale: 'Financial snapshot analysis requires accuracy' },
}

const TASK_LABELS: Record<string, string> = {
  nemoclaw:       'NemoClaw™ Calibration',
  viva:           'Viva Preparation',
  meetings:       'Meeting Intelligence',
  literature:     'Literature Agent',
  notifications:  'Smart Notifications',
  tasks:          'Task Management',
  insights:       'Insight Capture',
  chief_of_staff: 'Chief of Staff',
  research:       'Research Analysis',
  financial:      'Financial Snapshot',
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Try to load saved config from user preferences
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('ai_model_routes')
      .eq('user_id', user.id)
      .single()

    const savedRoutes = (prefs as any)?.ai_model_routes ?? {}
    const routes = { ...DEFAULT_ROUTES }
    for (const [task, cfg] of Object.entries(savedRoutes)) {
      if (routes[task] && MODELS[cfg as string]) {
        routes[task] = { ...routes[task], model: cfg as string }
      }
    }

    return NextResponse.json({
      ok:       true,
      routes,
      task_labels: TASK_LABELS,
      models:   MODELS,
      defaults: DEFAULT_ROUTES,
    })
  } catch (err: any) {
    console.error('[PIOS model-router GET]', err)
    return apiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action, routes: newRoutes, task, prompt } = body

    // ── Save routing config ───────────────────────────────────────────────────
    if (action === 'save') {
      // Validate models
      const validated: Record<string, string> = {}
      for (const [t, m] of Object.entries(newRoutes ?? {})) {
        if (TASK_LABELS[t] && MODELS[m as string]) {
          validated[t] = m as string
        }
      }
      const { error } = await supabase
        .from('user_preferences')
        .upsert({ user_id: user.id, ai_model_routes: validated }, { onConflict: 'user_id' })
      if (error) throw error
      return NextResponse.json({ ok: true, action: 'save', saved: Object.keys(validated).length })
    }

    // ── Test a route ──────────────────────────────────────────────────────────
    if (action === 'test') {
      const routeCfg = DEFAULT_ROUTES[task] ?? { model: 'claude-sonnet-4-20250514' }
      const model    = body.model ?? routeCfg.model
      if (!MODELS[model]) return NextResponse.json({ error: 'Invalid model' }, { status: 400 })

      const testPrompt = prompt ?? `You are being tested for the PIOS ${TASK_LABELS[task] ?? task} task. Respond in exactly 2 sentences confirming you are ready and describing your approach.`
      const start = Date.now()
      const result = await completeWithFailover({
        system: 'You are a PIOS model-routing test harness. Follow the user prompt exactly and keep the reply concise.',
        messages: [{ role: 'user', content: testPrompt }],
        maxTokens: 150,
        preferredModel: model,
      })
      const latency  = Date.now() - start
      return NextResponse.json({
        ok:       true,
        action:   'test',
        model,
        task,
        response: result.content,
        latency_ms: latency,
        input_tokens: result.tokens.input,
        output_tokens: result.tokens.output,
        provider: result.provider,
        resolved_model: result.model,
        failover_occurred: result.failoverOccurred,
      })
    }

    // ── Benchmark — run all models on same prompt ─────────────────────────────
    if (action === 'benchmark') {
      const testPrompt = prompt ?? 'Summarise the key challenge of AI-enabled FM cost forecasting in exactly one sentence.'
      const results = await Promise.all(
        Object.keys(MODELS as Record<string,any>).map(async (model) => {
          const start = Date.now()
          try {
            const result = await completeWithFailover({
              system: 'You are a PIOS model benchmark harness. Return a short, direct response to the user prompt.',
              messages: [{ role: 'user', content: testPrompt }],
              maxTokens: 100,
              preferredModel: model,
            })
            const latency = Date.now() - start
            return {
              model,
              response: result.content,
              latency_ms: latency,
              tokens: result.tokens.output,
              provider: result.provider,
              resolved_model: result.model,
              failover_occurred: result.failoverOccurred,
              ok: true,
            }
          } catch (e: any) {
            return { model, response: '', latency_ms: Date.now() - start, error: e?.message, ok: false }
          }
        })
      )
      return NextResponse.json({ ok: true, action: 'benchmark', results, prompt: testPrompt })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err: any) {
    console.error('[PIOS model-router POST]', err)
    return apiError(err)
  }
}
