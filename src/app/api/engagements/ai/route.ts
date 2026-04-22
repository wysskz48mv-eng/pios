import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { callClaude } from '@/lib/ai/client'
import { requireWorkbenchUser } from '@/app/api/workbench/_auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type AiRequestBody = {
  engagement_id?: string
  step_number?: number
  framework_code?: string
  prompt?: string
  context?: Record<string, unknown>
}

function parseJsonObject(text: string): Record<string, unknown> {
  const clean = text.replace(/```json\n?|```\n?/g, '').trim()
  try {
    return JSON.parse(clean) as Record<string, unknown>
  } catch {
    const start = clean.indexOf('{')
    const end = clean.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('AI response did not contain JSON payload')
    }
    return JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireWorkbenchUser(req)
    if ('error' in auth) return auth.error

    const { user, admin } = auth
    const body = (await req.json()) as AiRequestBody

    const engagementId = String(body.engagement_id ?? '')
    const stepNumber = Number(body.step_number)
    const frameworkCode = String(body.framework_code ?? '').toUpperCase()
    const userPrompt = String(body.prompt ?? '').trim()

    if (!engagementId || !frameworkCode || !userPrompt) {
      return NextResponse.json(
        { error: 'engagement_id, framework_code, and prompt are required' },
        { status: 400 }
      )
    }

    if (!Number.isInteger(stepNumber) || stepNumber < 1 || stepNumber > 7) {
      return NextResponse.json({ error: 'step_number must be an integer between 1 and 7' }, { status: 400 })
    }

    const { data: engagement, error: engagementError } = await admin
      .from('consulting_engagements')
      .select('*')
      .eq('id', engagementId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (engagementError) throw engagementError
    if (!engagement) return NextResponse.json({ error: 'Engagement not found' }, { status: 404 })

    const { data: framework, error: frameworkError } = await admin
      .from('framework_library')
      .select('*')
      .eq('code', frameworkCode)
      .eq('active', true)
      .maybeSingle()

    if (frameworkError) throw frameworkError
    if (!framework) return NextResponse.json({ error: 'Framework not found' }, { status: 404 })

    if (stepNumber > 1) {
      const { data: previousStep, error: previousStepError } = await admin
        .from('engagement_steps')
        .select('gate_status')
        .eq('engagement_id', engagementId)
        .eq('step_number', stepNumber - 1)
        .maybeSingle()

      if (previousStepError) throw previousStepError
      if (!previousStep || previousStep.gate_status !== 'passed') {
        return NextResponse.json(
          { error: `Step ${stepNumber} is blocked until Step ${stepNumber - 1} is passed.` },
          { status: 409 }
        )
      }
    }

    if (stepNumber > Number(engagement.current_step ?? 1)) {
      return NextResponse.json(
        { error: `Step ${stepNumber} cannot run before the engagement reaches that stage.` },
        { status: 409 }
      )
    }

    const modelSystemPrompt = `You are the PIOS Consulting Workbench AI assistant.
You are helping a consultant progress through a 7-step engagement lifecycle.
Respond ONLY in JSON with this exact schema:
{
  "analysis": "string",
  "gate_status": "passed|failed|pending",
  "confidence_score": 0.0,
  "artifacts": {},
  "next_actions": ["..."]
}
- confidence_score must be between 0 and 1
- gate_status should reflect whether this step is complete enough to progress`

    const modelUserPrompt = `Framework: ${framework.name} (${framework.code})
Framework Description: ${framework.description}
Framework Prompt Guidance: ${framework.usage_prompt ?? 'n/a'}

Engagement Context:
${JSON.stringify({
  engagement_id: engagement.id,
  title: engagement.title,
  client_name: engagement.client_name,
  engagement_type: engagement.engagement_type,
  current_step: engagement.current_step,
  requested_step: stepNumber,
  extra_context: body.context ?? {},
}, null, 2)}

Consultant request:
${userPrompt}`

    const raw = await callClaude(
      [{ role: 'user', content: modelUserPrompt }],
      modelSystemPrompt,
      1400,
      'sonnet'
    )

    const parsed = parseJsonObject(raw)
    const confidenceScore = Math.min(1, Math.max(0, Number(parsed.confidence_score ?? 0.5)))
    const gateStatusRaw = String(parsed.gate_status ?? 'pending').toLowerCase()
    const gateStatus = gateStatusRaw === 'passed' || gateStatusRaw === 'failed' ? gateStatusRaw : 'pending'

    const { data: frameworkRun, error: frameworkRunError } = await admin
      .from('engagement_frameworks')
      .insert({
        engagement_id: engagementId,
        step_number: stepNumber,
        framework_code: frameworkCode,
        output: parsed,
        model_used: 'claude-sonnet-4-20250514',
        confidence_score: confidenceScore,
      })
      .select()
      .single()

    if (frameworkRunError) throw frameworkRunError

    const { data: step, error: stepError } = await admin
      .from('engagement_steps')
      .upsert(
        {
          engagement_id: engagementId,
          step_number: stepNumber,
          gate_status: gateStatus,
          confidence_score: confidenceScore,
          artefacts: parsed.artifacts ?? parsed,
          completed_at: gateStatus === 'passed' ? new Date().toISOString() : null,
        },
        { onConflict: 'engagement_id,step_number' }
      )
      .select()
      .single()

    if (stepError) throw stepError

    const nextStep = gateStatus === 'passed' ? Math.min(7, stepNumber + 1) : stepNumber
    const nextStatus = nextStep >= 7 && gateStatus === 'passed' ? 'completed' : engagement.status

    await admin
      .from('consulting_engagements')
      .update({
        current_step: Math.max(Number(engagement.current_step ?? 1), nextStep),
        status: nextStatus,
        framework_used: frameworkCode,
        ai_output: String(parsed.analysis ?? ''),
      })
      .eq('id', engagementId)
      .eq('user_id', user.id)

    return NextResponse.json({
      framework_run: frameworkRun,
      step,
      response: parsed,
      gate_status: gateStatus,
      confidence_score: confidenceScore,
      progressed_to_step: nextStep,
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}
