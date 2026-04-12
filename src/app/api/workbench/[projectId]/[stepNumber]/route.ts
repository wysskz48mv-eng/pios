import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/api-error'
import { callClaude } from '@/lib/ai/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { projectId: string; stepNumber: string }

type WorkbenchBody = {
  action?: string
  data?: Record<string, unknown>
}

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function parseJsonObject(text: string): Record<string, unknown> {
  const clean = text.replace(/```json\n?|```\n?/g, '').trim()
  return JSON.parse(clean) as Record<string, unknown>
}

async function requireProjectOwner(projectId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }

  const admin = getAdmin()
  const { data: project, error } = await admin
    .from('consulting_projects')
    .select('id,user_id,status,current_step')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error
  if (!project) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) }

  return { user, project, admin }
}

async function logAiInteraction(
  admin: ReturnType<typeof getAdmin>,
  projectId: string,
  stepNumber: number,
  interactionType: string,
  userInput: string,
  aiResponse: string,
  modelUsed: 'haiku' | 'sonnet'
) {
  try {
    await admin.from('ai_interactions').insert({
      project_id: projectId,
      step_number: stepNumber,
      interaction_type: interactionType,
      user_input: userInput,
      ai_response: aiResponse,
      model_used: modelUsed,
      tokens_used: null,
      cost_cents: null,
    })
  } catch {
    // Never fail the main workflow because of logging issues.
  }
}

async function handleDefineStep(projectId: string, action: string, data: Record<string, unknown>, admin: ReturnType<typeof getAdmin>) {
  if (action === 'generate_smart_question') {
    const clientRequest = String(data.client_request ?? '')
    const context = String(data.context ?? '')

    const raw = await callClaude(
      [{ role: 'user', content: `Client request: "${clientRequest}"\nContext: ${context}\n\nGenerate a SMART problem statement.` }],
      `You are a strategic advisor helping clarify consulting problems.

Convert vague requests into SMART questions (Specific, Measurable, Action-oriented, Relevant, Time-bound).

Return JSON only:
{
  "smart_question": "How can [company] improve [metric] from [current] to [target] by [date]?",
  "specificity_score": 0.9,
  "validation": {
    "specific": true,
    "measurable": true,
    "actionable": true,
    "relevant": true,
    "timebound": true
  }
}`,
      500,
      'haiku'
    )

    const smartData = parseJsonObject(raw)

    const { data: step, error } = await admin
      .from('analysis_steps')
      .upsert({
        project_id: projectId,
        step_number: 1,
        problem_statement: clientRequest,
        smart_question: String(smartData.smart_question ?? ''),
        status: 'in_progress',
      }, { onConflict: 'project_id,step_number' })
      .select()
      .single()

    if (error) throw error

    await logAiInteraction(admin, projectId, 1, 'smart_question_generation', clientRequest, String(smartData.smart_question ?? ''), 'haiku')

    return NextResponse.json({ success: true, data: smartData, step })
  }

  if (action === 'validate_definition') {
    const smartQuestion = String(data.smart_question ?? '')
    const stakeholders = data.stakeholders ?? []
    const constraints = data.constraints ?? []

    const raw = await callClaude(
      [{ role: 'user', content: `Problem statement: "${smartQuestion}"\nStakeholders: ${JSON.stringify(stakeholders)}\nConstraints: ${JSON.stringify(constraints)}\n\nValidate this SMART question.` }],
      `Check if this is a valid SMART problem statement.

Return JSON only:
{
  "is_smart": true,
  "gaps": ["list of missing SMART elements"],
  "suggestions": ["how to improve"]
}`,
      300,
      'haiku'
    )

    const validation = parseJsonObject(raw)
    return NextResponse.json({
      success: true,
      validation,
      gate_passed: Boolean(validation.is_smart),
    })
  }

  return NextResponse.json({ error: 'Unknown action for step 1' }, { status: 400 })
}

async function handleStructureStep(projectId: string, action: string, data: Record<string, unknown>, admin: ReturnType<typeof getAdmin>) {
  if (action === 'generate_issue_tree') {
    const smartQuestion = String(data.smart_question ?? '')
    const context = String(data.context ?? '')

    const raw = await callClaude(
      [{ role: 'user', content: `Main question: "${smartQuestion}"\n\nContext: ${context}\n\nBuild a MECE issue tree.` }],
      `You are a strategy consultant building Issue Trees.

Create a MECE issue tree by breaking down the main question into 2-3 sub-questions at Level 1, then 2-3 each at Level 2.

Return JSON only:
{
  "root": {
    "question": "main question",
    "children": [{ "question": "sub-question", "children": [{ "question": "sub-sub-question" }] }]
  },
  "mece_analysis": {
    "mutually_exclusive": true,
    "collectively_exhaustive": true,
    "gaps": []
  }
}`,
      1000,
      'sonnet'
    )

    const issueTreeData = parseJsonObject(raw)

    const { data: step, error } = await admin
      .from('analysis_steps')
      .upsert({
        project_id: projectId,
        step_number: 2,
        issue_tree: issueTreeData.root ?? null,
        mece_validation: issueTreeData.mece_analysis ?? null,
        status: 'in_progress',
      }, { onConflict: 'project_id,step_number' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data: issueTreeData, step })
  }

  if (action === 'validate_mece') {
    const issueTree = data.issue_tree ?? {}

    const raw = await callClaude(
      [{ role: 'user', content: `Issue tree: ${JSON.stringify(issueTree)}\n\nValidate MECE.` }],
      `Validate if this issue tree is MECE.

Return JSON only:
{
  "is_mece": true,
  "mutually_exclusive_score": 0.9,
  "collectively_exhaustive_score": 0.9,
  "issues": [],
  "suggestions": []
}`,
      400,
      'haiku'
    )

    const validation = parseJsonObject(raw)
    return NextResponse.json({ success: true, validation, gate_passed: Boolean(validation.is_mece) })
  }

  return NextResponse.json({ error: 'Unknown action for step 2' }, { status: 400 })
}

async function handlePrioritizeStep(projectId: string, action: string, data: Record<string, unknown>, admin: ReturnType<typeof getAdmin>) {
  if (action !== 'create_2x2_matrix') {
    return NextResponse.json({ error: 'Unknown action for step 3' }, { status: 400 })
  }

  const issues = Array.isArray(data.issues) ? data.issues.map((i) => String(i)) : []
  const impactData = (data.impact_data ?? {}) as Record<string, number>
  const effortData = (data.effort_data ?? {}) as Record<string, number>

  const scoredIssues = issues.map((issue) => {
    const impact = Number(impactData[issue] ?? 5)
    const effort = Number(effortData[issue] ?? 5)

    let quadrant = 'low_impact_low_effort'
    if (impact > 5 && effort <= 5) quadrant = 'quick_win'
    else if (impact > 5 && effort > 5) quadrant = 'major_project'
    else if (impact <= 5 && effort <= 5) quadrant = 'low_value'
    else quadrant = 'avoid'

    return { issue, impact, effort, quadrant }
  })

  const workSequence = [
    ...scoredIssues.filter((i) => i.quadrant === 'quick_win').sort((a, b) => b.impact - a.impact).map((i) => i.issue),
    ...scoredIssues.filter((i) => i.quadrant === 'major_project').sort((a, b) => b.impact - a.impact).map((i) => i.issue),
    ...scoredIssues.filter((i) => i.quadrant === 'low_value').map((i) => i.issue),
  ]

  const { data: step, error } = await admin
    .from('analysis_steps')
    .upsert({
      project_id: projectId,
      step_number: 3,
      prioritization_matrix: { issues: scoredIssues },
      work_sequence: workSequence,
      status: 'in_progress',
    }, { onConflict: 'project_id,step_number' })
    .select()
    .single()

  if (error) throw error

  return NextResponse.json({ success: true, matrix: scoredIssues, sequence: workSequence, step })
}

async function handlePlanStep(projectId: string, action: string, data: Record<string, unknown>, admin: ReturnType<typeof getAdmin>) {
  if (action !== 'generate_work_plan') {
    return NextResponse.json({ error: 'Unknown action for step 4' }, { status: 400 })
  }

  const workSequence = Array.isArray(data.work_sequence) ? data.work_sequence.map((v) => String(v)) : []
  const teamComposition = String(data.team_composition ?? '')
  const deadline = String(data.deadline ?? '')

  const raw = await callClaude(
    [{ role: 'user', content: `Issues to analyze: ${workSequence.join(', ')}\nTeam: ${teamComposition}\nDeadline: ${deadline}\n\nCreate work plan.` }],
    `You are a project manager creating detailed work plans.

Generate a RACI matrix and Gantt chart for consulting analysis.

Return JSON only:
{
  "raci_matrix": {
    "tasks": [
      { "task": "name", "responsible": "role", "accountable": "role", "consulted": ["role"], "informed": ["role"] }
    ]
  },
  "gantt_chart": {
    "phases": [
      { "phase": "name", "tasks": ["task1"], "duration_days": 5, "dependencies": [], "start_week": 1 }
    ]
  },
  "critical_path": ["task sequence"]
}`,
    1000,
    'sonnet'
  )

  const planData = parseJsonObject(raw)

  const { data: step, error } = await admin
    .from('analysis_steps')
    .upsert({
      project_id: projectId,
      step_number: 4,
      raci_matrix: planData.raci_matrix ?? null,
      project_timeline: planData.gantt_chart ?? null,
      status: 'in_progress',
    }, { onConflict: 'project_id,step_number' })
    .select()
    .single()

  if (error) throw error

  return NextResponse.json({ success: true, data: planData, step })
}

async function handleAnalyzeStep(projectId: string, action: string, data: Record<string, unknown>, admin: ReturnType<typeof getAdmin>) {
  if (action === 'generate_research_guides') {
    const hypotheses = data.hypotheses ?? []
    const availableData = String(data.available_data ?? '')

    const raw = await callClaude(
      [{ role: 'user', content: `Hypotheses: ${JSON.stringify(hypotheses)}\nAvailable data: ${availableData}\n\nGenerate research guides.` }],
      `Generate research guides for hypothesis testing.

For each hypothesis, suggest key questions, data to gather, interview structure, and survey questions.

Return JSON only:
{
  "research_guides": [
    { "hypothesis": "...", "questions": [], "data_needed": [] }
  ]
}`,
      800,
      'haiku'
    )

    const guideData = parseJsonObject(raw)

    const { data: step, error } = await admin
      .from('analysis_steps')
      .upsert({
        project_id: projectId,
        step_number: 5,
        research_guides: guideData.research_guides ?? [],
        status: 'in_progress',
      }, { onConflict: 'project_id,step_number' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data: guideData, step })
  }

  if (action === 'upload_data') {
    const rawData = data.raw_data ?? {}

    const { data: step, error } = await admin
      .from('analysis_steps')
      .upsert({
        project_id: projectId,
        step_number: 5,
        raw_data: rawData,
        data_quality_score: 0.5,
        status: 'in_progress',
      }, { onConflict: 'project_id,step_number' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, step })
  }

  return NextResponse.json({ error: 'Unknown action for step 5' }, { status: 400 })
}

async function handleSynthesizeStep(projectId: string, action: string, data: Record<string, unknown>, admin: ReturnType<typeof getAdmin>) {
  if (action !== 'apply_pyramid_principle') {
    return NextResponse.json({ error: 'Unknown action for step 6' }, { status: 400 })
  }

  const rawFindings = data.raw_findings ?? {}
  const mainInsight = String(data.main_insight ?? '')

  const raw = await callClaude(
    [{ role: 'user', content: `Main insight: "${mainInsight}"\n\nRaw findings: ${JSON.stringify(rawFindings)}\n\nStructure with Pyramid Principle.` }],
    `Apply Pyramid Principle to organize findings.

Structure: Conclusion -> Key Arguments -> Supporting Evidence.

Return JSON only:
{
  "pyramid": {
    "conclusion": "main insight",
    "key_arguments": ["arg1", "arg2", "arg3"],
    "supporting_evidence": { "arg1": [], "arg2": [] }
  },
  "so_what_analysis": {
    "implications": [],
    "decision_impact": ""
  }
}`,
    800,
    'sonnet'
  )

  const synthesisData = parseJsonObject(raw)

  const { data: step, error } = await admin
    .from('analysis_steps')
    .upsert({
      project_id: projectId,
      step_number: 6,
      synthesized_findings: synthesisData.pyramid ?? null,
      pyramid_structure: synthesisData.pyramid ?? null,
      confidence_level: 0.75,
      status: 'in_progress',
    }, { onConflict: 'project_id,step_number' })
    .select()
    .single()

  if (error) throw error

  return NextResponse.json({ success: true, data: synthesisData, step })
}

async function handleRecommendStep(projectId: string, action: string, data: Record<string, unknown>, admin: ReturnType<typeof getAdmin>) {
  if (action !== 'generate_recommendations') {
    return NextResponse.json({ error: 'Unknown action for step 7' }, { status: 400 })
  }

  const insights = data.insights ?? {}
  const constraints = String(data.constraints ?? '')
  const objectives = String(data.objectives ?? '')

  const raw = await callClaude(
    [{ role: 'user', content: `Insights: ${JSON.stringify(insights)}\nConstraints: ${constraints}\nObjectives: ${objectives}\n\nGenerate recommendations.` }],
    `Generate strategic recommendations with three options: aggressive, balanced, conservative.

For each option include pros, cons, financial impact, timeline, risk, and implementation requirements.

Return JSON only:
{
  "options": [
    { "name": "...", "pros": [], "cons": [], "impact": "...", "timeline": "...", "risk": "..." }
  ],
  "recommendation": "primary recommendation with rationale",
  "next_steps": []
}`,
    1200,
    'sonnet'
  )

  const recData = parseJsonObject(raw)

  const { data: step, error } = await admin
    .from('analysis_steps')
    .upsert({
      project_id: projectId,
      step_number: 7,
      options: recData.options ?? [],
      recommendation: String(recData.recommendation ?? ''),
      implementation_roadmap: recData.next_steps ?? [],
      status: 'completed',
      gate_status: 'passed',
    }, { onConflict: 'project_id,step_number' })
    .select()
    .single()

  if (error) throw error

  await admin
    .from('consulting_projects')
    .update({ current_step: 7, status: 'completed' })
    .eq('id', projectId)

  return NextResponse.json({ success: true, data: recData, step })
}

async function handleGenerateSlides(projectId: string, admin: ReturnType<typeof getAdmin>) {
  const { data: steps, error } = await admin
    .from('analysis_steps')
    .select('*')
    .eq('project_id', projectId)
    .order('step_number', { ascending: true })

  if (error) throw error

  const raw = await callClaude(
    [{ role: 'user', content: `Analysis steps: ${JSON.stringify(steps ?? [])}\n\nCreate PowerPoint structure.` }],
    `Convert consulting analysis into a PowerPoint slide structure.

Return JSON only:
{
  "title_slide": {},
  "executive_summary": {},
  "sections": [
    { "slide_number": 1, "title": "...", "content": {}, "visual": "..." }
  ]
}`,
    2000,
    'sonnet'
  )

  const slideStructure = parseJsonObject(raw)

  await admin.from('project_artifacts').insert({
    project_id: projectId,
    artifact_type: 'slides',
    artifact_name: 'Executive Presentation',
    storage_path: `/slides/${projectId}/presentation.pptx`,
    generated_from_step: 7,
  })

  return NextResponse.json({ success: true, slides: slideStructure })
}

export async function POST(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { projectId, stepNumber } = await context.params
    const { error, admin } = await requireProjectOwner(projectId)
    if (error) return error

    const body = await req.json() as WorkbenchBody
    const action = String(body.action ?? '')
    const data = body.data ?? {}

    const step = Number(stepNumber)
    if (!Number.isInteger(step) || step < 1 || step > 7) {
      return NextResponse.json({ error: 'Invalid step' }, { status: 400 })
    }

    if (step === 1) return handleDefineStep(projectId, action, data, admin)
    if (step === 2) return handleStructureStep(projectId, action, data, admin)
    if (step === 3) return handlePrioritizeStep(projectId, action, data, admin)
    if (step === 4) return handlePlanStep(projectId, action, data, admin)
    if (step === 5) return handleAnalyzeStep(projectId, action, data, admin)
    if (step === 6) return handleSynthesizeStep(projectId, action, data, admin)
    return handleRecommendStep(projectId, action, data, admin)
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function GET(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { projectId } = await context.params
    const { error, admin } = await requireProjectOwner(projectId)
    if (error) return error

    const action = req.nextUrl.searchParams.get('action')
    if (action === 'generate_slides') {
      return handleGenerateSlides(projectId, admin)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: unknown) {
    return apiError(err)
  }
}
