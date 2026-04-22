// @ts-nocheck
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { checkPromptSafety } from '@/lib/security-middleware'
import { checkRateLimit, LIMITS } from '@/lib/redis-rate-limit'
import { NEMOCLAW_TOOLS, runNemoclawTool } from '@/lib/nemoclaw/tool-registry'

export const runtime = 'nodejs'
export const maxDuration = 60

function toAnthropicMessages(messages) {
  return messages
    .filter((m) => m?.role === 'user' || m?.role === 'assistant')
    .map((m) => ({ role: m.role, content: String(m.content ?? '') }))
}

async function buildLiveContext(supabase, userId) {
  const [tasks, projects, emails, stakeholders, docs] = await Promise.all([
    supabase.from('tasks').select('title,status,priority,due_date').eq('user_id', userId).not('status', 'in', '(done,cancelled)').limit(8),
    supabase.from('projects').select('title,status,progress').eq('user_id', userId).neq('status', 'cancelled').limit(6),
    supabase.from('email_items').select('subject,triage_class,is_read,received_at').eq('user_id', userId).order('received_at', { ascending: false }).limit(8),
    supabase.from('stakeholders').select('name,role,influence,next_touchpoint').eq('user_id', userId).limit(6),
    supabase.from('file_items').select('name,file_type,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(6),
  ])

  const overdue = (tasks.data ?? []).filter((t) => t.due_date && t.due_date < new Date().toISOString().slice(0, 10))
  const urgent = (emails.data ?? []).filter((e) => e.triage_class === 'urgent')

  return [
    `TODAY: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
    `OPEN TASKS: ${(tasks.data ?? []).length} (${overdue.length} overdue)`,
    `ACTIVE PROJECTS: ${(projects.data ?? []).filter((p) => p.status === 'active').length}`,
    `EMAILS: ${(emails.data ?? []).length} recent (${urgent.length} urgent)`,
    `STAKEHOLDERS: ${(stakeholders.data ?? []).length} tracked`,
    `RECENT FILES: ${(docs.data ?? []).map((d) => d.name).join(', ') || 'None'}`,
  ].join('\n')
}

async function runToolCalling({ anthropic, system, messages, supabase, userId }) {
  let transcript = toAnthropicMessages(messages)
  const toolsUsed = []

  for (let i = 0; i < 3; i += 1) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      temperature: 0.2,
      system,
      tools: NEMOCLAW_TOOLS,
      messages: transcript,
    })

    const textBlocks = response.content.filter((b) => b.type === 'text')
    const textReply = textBlocks.map((b) => b.text).join('\n').trim()

    const toolUses = response.content.filter((b) => b.type === 'tool_use')
    if (!toolUses.length) {
      return { reply: textReply || 'No response generated.', toolsUsed }
    }

    transcript.push({ role: 'assistant', content: response.content })

    const toolResults = []
    for (const toolUse of toolUses) {
      const result = await runNemoclawTool(supabase, userId, toolUse.name, toolUse.input || {})
      toolsUsed.push(toolUse.name)
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      })
    }

    transcript.push({ role: 'user', content: toolResults })
  }

  return { reply: 'I reached the tool execution limit. Please refine your request.', toolsUsed }
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    let rl = null
    try {
      rl = await checkRateLimit({ key: `pios:ai:${ip}`, ...LIMITS.ai })
    } catch {}
    if (rl) return NextResponse.json({ reply: "You're sending messages too quickly. Please wait a moment." }, { status: 200 })

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ reply: 'Please sign in to use NemoClaw.' }, { status: 200 })

    const body = await request.json().catch(() => ({}))
    const moduleContext = body.moduleContext ?? { route: '/platform/dashboard', title: 'Command Centre' }

    let messages = body.messages
    if (!Array.isArray(messages)) {
      const msg = String(body.message ?? '').trim()
      messages = msg ? [{ role: 'user', content: msg }] : []
    }
    if (!messages.length) return NextResponse.json({ reply: 'Please type a message.' }, { status: 200 })

    const userText = String(messages[messages.length - 1]?.content ?? '')
    const safety = checkPromptSafety(userText)
    if (!safety.safe) {
      return NextResponse.json({ reply: "I can't process that request. Please rephrase your question." }, { status: 200 })
    }

    const [{ data: profile }, { data: calibration }] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('full_name,job_title,organisation,persona_type')
        .eq('id', user.id)
        .single(),
      supabase
        .from('nemoclaw_calibration')
        .select('communication_register,coaching_intensity,recommended_frameworks,top_competencies,cv_profile_summary')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    const context = await buildLiveContext(supabase, user.id)

    const topCompetencyLine = Array.isArray(calibration?.top_competencies)
      ? calibration.top_competencies
        .slice(0, 4)
        .map((item: any) => `${item.dimension ?? 'Competency'} ${item.score ?? '-'}%`)
        .join(', ')
      : 'No competency profile yet'

    const system = `You are NemoClaw™, the persistent AI operating layer inside PIOS.

USER:
- Name: ${profile?.full_name ?? 'User'}
- Role: ${profile?.job_title ?? 'Executive'}
- Organisation: ${profile?.organisation ?? 'PIOS'}
- Persona: ${profile?.persona_type ?? 'professional'}
- Communication register: ${calibration?.communication_register ?? 'professional'}
- Coaching intensity: ${calibration?.coaching_intensity ?? 'balanced'}
- Recommended frameworks: ${(calibration?.recommended_frameworks ?? []).join(', ') || 'none'}
- Top competencies: ${topCompetencyLine}
- Calibration summary: ${calibration?.cv_profile_summary ?? 'Not yet calibrated from CV'}

CURRENT MODULE CONTEXT:
- Route: ${moduleContext.route}
- Screen: ${moduleContext.title}

LIVE SNAPSHOT:
${context}

RULES:
- Be concise, practical, and action-oriented.
- If tools return data, cite specific names, statuses, counts, and dates.
- If data is missing, state that directly.
- Prefer markdown bullets and short sections.`

    if (!process.env.ANTHROPIC_API_KEY) {
      const fallback = await callClaude(messages, system, 1200)
      return NextResponse.json({ reply: fallback, tools_used: [] })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const out = await runToolCalling({ anthropic, system, messages, supabase, userId: user.id })
    return NextResponse.json({ reply: out.reply, tools_used: out.toolsUsed })
  } catch (error) {
    console.error('[NemoClaw chat error]', error)
    return NextResponse.json({ reply: 'NemoClaw is temporarily unavailable. Please try again.' }, { status: 200 })
  }
}
