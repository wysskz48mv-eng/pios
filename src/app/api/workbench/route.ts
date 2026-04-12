// File: src/app/api/workbench/[projectId]/[stepNumber]/route.ts
// Purpose: 7-step consulting framework execution endpoints

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Anthropic } from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const claudeClient = new Anthropic();

// ============================================================================
// STEP 1: DEFINE PROBLEM
// ============================================================================

export async function POST(req: NextRequest, { params }: { params: { projectId: string; stepNumber: string } }) {
  const { projectId, stepNumber } = params;
  const { action, data } = await req.json();

  if (stepNumber === '1') {
    return handleDefineStep(projectId, action, data);
  }
  if (stepNumber === '2') {
    return handleStructureStep(projectId, action, data);
  }
  if (stepNumber === '3') {
    return handlePrioritizeStep(projectId, action, data);
  }
  if (stepNumber === '4') {
    return handlePlanStep(projectId, action, data);
  }
  if (stepNumber === '5') {
    return handleAnalyzeStep(projectId, action, data);
  }
  if (stepNumber === '6') {
    return handleSynthesizeStep(projectId, action, data);
  }
  if (stepNumber === '7') {
    return handleRecommendStep(projectId, action, data);
  }

  return NextResponse.json({ error: 'Invalid step' }, { status: 400 });
}

// ============================================================================
// STEP 1: DEFINE PROBLEM (Clarify with SMART question)
// ============================================================================

async function handleDefineStep(projectId: string, action: string, data: any) {
  if (action === 'generate_smart_question') {
    const { client_request, context } = data;

    // Use Claude Haiku for fast, cheap guidance
    const message = await claudeClient.messages.create({
      model: 'claude-haiku-4-20250507',
      max_tokens: 500,
      system: `You are a strategic advisor helping clarify consulting problems.
      
Convert vague requests into SMART questions (Specific, Measurable, Action-oriented, Relevant, Time-bound).

Format response as JSON:
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
      messages: [
        {
          role: 'user',
          content: `Client request: "${client_request}"
Context: ${context}

Generate a SMART problem statement.`
        }
      ]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const smartData = JSON.parse(responseText);

    // Save to database
    const { data: step, error } = await supabase
      .from('analysis_steps')
      .upsert({
        project_id: projectId,
        step_number: 1,
        problem_statement: client_request,
        smart_question: smartData.smart_question,
        status: 'in_progress'
      }, { onConflict: 'project_id,step_number' })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log AI interaction
    await supabase.from('ai_interactions').insert({
      project_id: projectId,
      step_number: 1,
      interaction_type: 'smart_question_generation',
      user_input: client_request,
      ai_response: smartData.smart_question,
      model_used: 'haiku',
      tokens_used: message.usage?.input_tokens || 0
    });

    return NextResponse.json({ success: true, data: smartData, step: step?.[0] });
  }

  if (action === 'validate_definition') {
    const { smart_question, stakeholders, constraints } = data;

    // Validate SMART criteria
    const message = await claudeClient.messages.create({
      model: 'claude-haiku-4-20250507',
      max_tokens: 300,
      system: `Check if this is a valid SMART problem statement.
      
Return JSON:
{
  "is_smart": boolean,
  "gaps": ["list of missing SMART elements"],
  "suggestions": ["how to improve"]
}`,
      messages: [
        {
          role: 'user',
          content: `Problem statement: "${smart_question}"\nStakeholders: ${JSON.stringify(stakeholders)}\nConstraints: ${JSON.stringify(constraints)}\n\nValidate this SMART question.`
        }
      ]
    });

    const validation = JSON.parse(
      message.content[0].type === 'text' ? message.content[0].text : '{}'
    );

    return NextResponse.json({
      success: true,
      validation,
      gate_passed: validation.is_smart
    });
  }
}

// ============================================================================
// STEP 2: STRUCTURE PROBLEM (Issue Tree, MECE validation)
// ============================================================================

async function handleStructureStep(projectId: string, action: string, data: any) {
  if (action === 'generate_issue_tree') {
    const { smart_question, context } = data;

    const message = await claudeClient.messages.create({
      model: 'claude-sonnet-4-20250514', // Sonnet for better logic structure
      max_tokens: 1000,
      system: `You are a strategy consultant building Issue Trees.

Create a MECE (Mutually Exclusive, Collectively Exhaustive) issue tree by breaking down the main question into 2-3 sub-questions at Level 1, then 2-3 each at Level 2.

Format as JSON:
{
  "root": {
    "question": "main question here",
    "children": [
      {
        "question": "Level 1 sub-question",
        "children": [
          { "question": "Level 2 sub-question" }
        ]
      }
    ]
  },
  "mece_analysis": {
    "mutually_exclusive": true,
    "collectively_exhaustive": true,
    "gaps": []
  }
}`,
      messages: [
        {
          role: 'user',
          content: `Main question: "${smart_question}"\n\nContext: ${context}\n\nBuild a MECE issue tree.`
        }
      ]
    });

    const issueTreeData = JSON.parse(
      message.content[0].type === 'text' ? message.content[0].text : '{}'
    );

    // Save to database
    const { data: step } = await supabase
      .from('analysis_steps')
      .upsert({
        project_id: projectId,
        step_number: 2,
        issue_tree: issueTreeData.root,
        mece_validation: issueTreeData.mece_analysis,
        status: 'in_progress'
      }, { onConflict: 'project_id,step_number' })
      .select();

    return NextResponse.json({ success: true, data: issueTreeData, step: step?.[0] });
  }

  if (action === 'validate_mece') {
    const { issue_tree } = data;

    const message = await claudeClient.messages.create({
      model: 'claude-haiku-4-20250507',
      max_tokens: 400,
      system: `Validate if this issue tree is MECE (Mutually Exclusive, Collectively Exhaustive).

Return JSON:
{
  "is_mece": boolean,
  "mutually_exclusive_score": 0.0-1.0,
  "collectively_exhaustive_score": 0.0-1.0,
  "issues": ["list of issues"],
  "suggestions": ["how to improve"]
}`,
      messages: [
        {
          role: 'user',
          content: `Issue tree: ${JSON.stringify(issue_tree)}\n\nValidate MECE.`
        }
      ]
    });

    const validation = JSON.parse(
      message.content[0].type === 'text' ? message.content[0].text : '{}'
    );

    return NextResponse.json({
      success: true,
      validation,
      gate_passed: validation.is_mece
    });
  }
}

// ============================================================================
// STEP 3: PRIORITIZE (2x2 Matrix, Impact vs. Effort)
// ============================================================================

async function handlePrioritizeStep(projectId: string, action: string, data: any) {
  if (action === 'create_2x2_matrix') {
    const { issues, impact_data, effort_data } = data;

    // Score each issue
    const scoredIssues = issues.map((issue: string) => {
      const impact = impact_data[issue] || 5; // 1-10
      const effort = effort_data[issue] || 5;

      let quadrant = 'low_impact_low_effort';
      if (impact > 5 && effort <= 5) quadrant = 'quick_win';
      if (impact > 5 && effort > 5) quadrant = 'major_project';
      if (impact <= 5 && effort <= 5) quadrant = 'low_value';
      if (impact <= 5 && effort > 5) quadrant = 'avoid';

      return { issue, impact, effort, quadrant };
    });

    // Prioritize: Quick wins first, then major projects, then low value
    const workSequence = [
      ...scoredIssues
        .filter(i => i.quadrant === 'quick_win')
        .sort((a, b) => b.impact - a.impact)
        .map(i => i.issue),
      ...scoredIssues
        .filter(i => i.quadrant === 'major_project')
        .sort((a, b) => b.impact - a.impact)
        .map(i => i.issue),
      ...scoredIssues
        .filter(i => i.quadrant === 'low_value')
        .map(i => i.issue)
    ];

    // Save to database
    const { data: step } = await supabase
      .from('analysis_steps')
      .upsert({
        project_id: projectId,
        step_number: 3,
        prioritization_matrix: { issues: scoredIssues },
        work_sequence: workSequence,
        status: 'in_progress'
      }, { onConflict: 'project_id,step_number' })
      .select();

    return NextResponse.json({
      success: true,
      matrix: scoredIssues,
      sequence: workSequence,
      step: step?.[0]
    });
  }
}

// ============================================================================
// STEP 4: WORK PLAN (RACI, Gantt, Timeline)
// ============================================================================

async function handlePlanStep(projectId: string, action: string, data: any) {
  if (action === 'generate_work_plan') {
    const { work_sequence, team_composition, deadline } = data;

    const message = await claudeClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `You are a project manager creating detailed work plans.

Generate a RACI matrix and Gantt chart for consulting analysis.

Return JSON:
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
      messages: [
        {
          role: 'user',
          content: `Issues to analyze: ${work_sequence.join(', ')}\nTeam: ${team_composition}\nDeadline: ${deadline}\n\nCreate work plan.`
        }
      ]
    });

    const planData = JSON.parse(
      message.content[0].type === 'text' ? message.content[0].text : '{}'
    );

    // Save
    const { data: step } = await supabase
      .from('analysis_steps')
      .upsert({
        project_id: projectId,
        step_number: 4,
        raci_matrix: planData.raci_matrix,
        project_timeline: planData.gantt_chart,
        status: 'in_progress'
      }, { onConflict: 'project_id,step_number' })
      .select();

    return NextResponse.json({ success: true, data: planData, step: step?.[0] });
  }
}

// ============================================================================
// STEP 5: CONDUCT ANALYSIS (Data gathering)
// ============================================================================

async function handleAnalyzeStep(projectId: string, action: string, data: any) {
  if (action === 'generate_research_guides') {
    const { hypotheses, available_data } = data;

    const message = await claudeClient.messages.create({
      model: 'claude-haiku-4-20250507',
      max_tokens: 800,
      system: `Generate research guides for hypothesis testing.

For each hypothesis, suggest:
- Key questions to ask
- Data to gather
- Interview structure
- Survey questions

Return JSON:
{
  "research_guides": [
    { "hypothesis": "...", "questions": [...], "data_needed": [...] }
  ]
}`,
      messages: [
        {
          role: 'user',
          content: `Hypotheses: ${JSON.stringify(hypotheses)}\nAvailable data: ${available_data}\n\nGenerate research guides.`
        }
      ]
    });

    const guideData = JSON.parse(
      message.content[0].type === 'text' ? message.content[0].text : '{}'
    );

    // Save
    const { data: step } = await supabase
      .from('analysis_steps')
      .upsert({
        project_id: projectId,
        step_number: 5,
        research_guides: guideData.research_guides,
        status: 'in_progress'
      }, { onConflict: 'project_id,step_number' })
      .select();

    return NextResponse.json({ success: true, data: guideData, step: step?.[0] });
  }

  if (action === 'upload_data') {
    const { data_type, raw_data } = data; // data_type: interviews, surveys, documents, analysis

    const { data: step } = await supabase
      .from('analysis_steps')
      .update({
        raw_data: { ...raw_data },
        data_quality_score: 0.5 // Will be updated as more data arrives
      })
      .eq('project_id', projectId)
      .eq('step_number', 5)
      .select();

    return NextResponse.json({ success: true, step: step?.[0] });
  }
}

// ============================================================================
// STEP 6: SYNTHESIZE (Pyramid Principle)
// ============================================================================

async function handleSynthesizeStep(projectId: string, action: string, data: any) {
  if (action === 'apply_pyramid_principle') {
    const { raw_findings, main_insight } = data;

    const message = await claudeClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: `Apply Pyramid Principle to organize findings.

Structure: Conclusion (main insight) → Key Arguments (3-5) → Supporting Evidence (data)

Return JSON:
{
  "pyramid": {
    "conclusion": "main insight",
    "key_arguments": ["arg1", "arg2", "arg3"],
    "supporting_evidence": { "arg1": [...data], "arg2": [...data] }
  },
  "so_what_analysis": {
    "implications": [...],
    "decision_impact": "..."
  }
}`,
      messages: [
        {
          role: 'user',
          content: `Main insight: "${main_insight}"\n\nRaw findings: ${JSON.stringify(raw_findings)}\n\nStructure with Pyramid Principle.`
        }
      ]
    });

    const synthesisData = JSON.parse(
      message.content[0].type === 'text' ? message.content[0].text : '{}'
    );

    // Save
    const { data: step } = await supabase
      .from('analysis_steps')
      .upsert({
        project_id: projectId,
        step_number: 6,
        synthesized_findings: synthesisData.pyramid,
        confidence_level: 0.75,
        status: 'in_progress'
      }, { onConflict: 'project_id,step_number' })
      .select();

    return NextResponse.json({ success: true, data: synthesisData, step: step?.[0] });
  }
}

// ============================================================================
// STEP 7: RECOMMEND (Decision, Options, Risks)
// ============================================================================

async function handleRecommendStep(projectId: string, action: string, data: any) {
  if (action === 'generate_recommendations') {
    const { insights, constraints, objectives } = data;

    const message = await claudeClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      system: `Generate strategic recommendations with multiple options.

Provide 3 options (aggressive, balanced, conservative) with:
- Pros/cons
- Financial impact
- Timeline
- Risk assessment
- Implementation requirements

Return JSON:
{
  "options": [
    { "name": "...", "pros": [...], "cons": [...], "impact": "...", "timeline": "...", "risk": "..." }
  ],
  "recommendation": "primary recommendation with rationale",
  "next_steps": [...]
}`,
      messages: [
        {
          role: 'user',
          content: `Insights: ${JSON.stringify(insights)}\nConstraints: ${constraints}\nObjectives: ${objectives}\n\nGenerate recommendations.`
        }
      ]
    });

    const recData = JSON.parse(
      message.content[0].type === 'text' ? message.content[0].text : '{}'
    );

    // Save
    const { data: step } = await supabase
      .from('analysis_steps')
      .upsert({
        project_id: projectId,
        step_number: 7,
        options: recData.options,
        recommendation: recData.recommendation,
        status: 'completed'
      }, { onConflict: 'project_id,step_number' })
      .select();

    // Update project status
    await supabase
      .from('consulting_projects')
      .update({ current_step: 7, status: 'completed' })
      .eq('id', projectId);

    return NextResponse.json({ success: true, data: recData, step: step?.[0] });
  }
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const { projectId } = params;
  const action = req.nextUrl.searchParams.get('action');

  if (action === 'generate_slides') {
    // Get all completed steps
    const { data: steps } = await supabase
      .from('analysis_steps')
      .select('*')
      .eq('project_id', projectId)
      .order('step_number');

    // Use Claude to generate PowerPoint structure
    const message = await claudeClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: `Convert consulting analysis into PowerPoint slide structure.

Return JSON with slide-by-slide outline:
{
  "title_slide": {...},
  "executive_summary": {...},
  "sections": [
    { "slide_number": 1, "title": "...", "content": {...}, "visual": "..." }
  ]
}`,
      messages: [
        {
          role: 'user',
          content: `Analysis steps: ${JSON.stringify(steps)}\n\nCreate PowerPoint structure.`
        }
      ]
    });

    const slideStructure = JSON.parse(
      message.content[0].type === 'text' ? message.content[0].text : '{}'
    );

    // Save as artifact
    await supabase.from('project_artifacts').insert({
      project_id: projectId,
      artifact_type: 'slides',
      artifact_name: 'Executive Presentation',
      storage_path: `/slides/${projectId}/presentation.pptx`,
      generated_from_step: 7
    });

    return NextResponse.json({ success: true, slides: slideStructure });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
