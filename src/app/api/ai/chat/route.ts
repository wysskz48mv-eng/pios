import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { checkPromptSafety, auditLog, IP_HEADERS } from '@/lib/security-middleware'
import { checkRateLimit, LIMITS } from '@/lib/redis-rate-limit'

export const runtime    = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/ai/chat
 * Powers the PIOS AI Companion (/platform/ai).
 *
 * Injects live context per call:
 *   - Today's brief (if generated) — gives the AI Douglas's full daily snapshot
 *   - Overdue tasks (flagged separately — not buried in the task list)
 *   - Due-today tasks
 *   - Open tasks with priorities
 *   - Academic modules + thesis velocity
 *   - Active projects
 *   - Unread notifications
 *   - Domain focus (from domainContext param)
 *
 * System prompt encodes Douglas's full profile so responses are
 * contextually appropriate without him having to re-explain his work.
 *
 * PIOS v2.2 | VeritasIQ Technologies Ltd
 */
export async function POST(request: Request) {
  try {
    // Rate limiting — ISO 27001 A.12.6
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const rl = await checkRateLimit({ key: `pios:ai:${ip}`, ...LIMITS.ai })
    if (rl) return rl
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messages, domainContext } = await request.json()
    if (!messages?.length) return NextResponse.json({ error: 'No messages' }, { status: 400 })

    // IS-POL-008 SSDLC — Prompt injection defence
    const lastMsg = [...messages].reverse().find((m: {role:string}) => m.role === 'user')
    const userText = typeof lastMsg?.content === 'string' ? lastMsg.content : ''
    if (userText) {
      const safety = checkPromptSafety(userText)
      if (!safety.safe) {
        return NextResponse.json({ error: 'Request blocked by security policy.' }, { status: 400, headers: IP_HEADERS })
      }
    }

    const today = new Date().toISOString().slice(0, 10)

    // Gather live context in parallel
    // Fetch persona first (cheap)
    const { data: aiProfile } = await supabase
      .from('user_profiles').select('persona_type,full_name,job_title,organisation').eq('id', user.id).single()
    const aiPersona = (aiProfile as Record<string,unknown> | null)?.persona_type as string ?? 'individual'
    const aiIsExec  = ['executive','founder','professional'].includes(aiPersona)

    // Fetch user training config (NemoClaw context)
    const { data: trainCfg } = await (supabase as any)
      .from('exec_intelligence_config')
      .select('persona_context,company_context,goals_context,custom_instructions,tone_preference,response_style')
      .eq('user_id', user.id)
      .maybeSingle()
    const tc = trainCfg as any

    const [tasksR, modulesR, projectsR, chaptersR, notifsR, briefR] = await Promise.all([
      supabase.from('tasks').select('title,domain,priority,due_date,status')
        .eq('user_id', user.id).not('status', 'in', '("done","cancelled")')
        .order('due_date', { ascending: true }).limit(15),
      supabase.from('academic_modules').select('title,status,deadline')
        .eq('user_id', user.id).not('status', 'in', '("passed","failed")').limit(6),
      supabase.from('projects').select('title,domain,progress,status')
        .eq('user_id', user.id).eq('status', 'active').limit(6),
      supabase.from('thesis_chapters').select('title,chapter_num,status,word_count,target_words')
        .eq('user_id', user.id).order('chapter_num').limit(6),
      supabase.from('notifications').select('title,type,domain')
        .eq('user_id', user.id).eq('read', false)
        .order('created_at', { ascending: false }).limit(5),
      supabase.from('daily_briefs').select('content')
        .eq('user_id', user.id).eq('brief_date', today).maybeSingle(),
    ])

    const tasks    = tasksR.data ?? []

    // Exec persona — fetch live OKR/decision/stakeholder state for AI context
    let execCtxStr = ''
    if (aiIsExec) {
      const [okrAiR, decAiR, stakeAiR] = await Promise.all([
        supabase.from('exec_okrs').select('title,health,progress').eq('user_id', user.id).eq('status','active').limit(5),
        supabase.from('exec_decisions').select('title,framework_used').eq('user_id', user.id).eq('status','open').limit(4),
        supabase.from('exec_stakeholders').select('name,importance,next_touchpoint')
          .eq('user_id', user.id)
          .lte('next_touchpoint', new Date(Date.now() + 7*86400000).toISOString().split('T')[0])
          .limit(3),
      ])
      const okrLines   = (okrAiR.data  ?? []).map((o:Record<string,unknown>) => `${o.title}: ${o.progress}% (${o.health})`).join(', ')
      const decLines   = (decAiR.data  ?? []).map((d:Record<string,unknown>) => `${d.title} [${d.framework_used ?? '?'}™]`).join(', ')
      const stakeLines = (stakeAiR.data ?? []).map((s:Record<string,unknown>) => `${s.name} [${s.importance}]`).join(', ')
      execCtxStr = [
        okrLines   ? `ACTIVE OKRs: ${okrLines}` : null,
        decLines   ? `OPEN DECISIONS: ${decLines}` : null,
        stakeLines ? `STAKEHOLDERS DUE: ${stakeLines}` : null,
      ].filter(Boolean).join('\n')
    }
    const overdue  = tasks.filter(t => t.due_date && t.due_date < today)
    const dueToday = tasks.filter(t => t.due_date === today)
    const upcoming = tasks.filter(t => !t.due_date || t.due_date > today)

    // Thesis velocity
    const chapters    = chaptersR.data ?? []
    const totalWords  = chapters.reduce((s, c) => s + (c.word_count ?? 0), 0)
    const targetWords = chapters.reduce((s, c) => s + (c.target_words ?? 8000), 0)
    const nearestDl   = (modulesR.data ?? []).map(m => m.deadline).filter(Boolean).sort()[0]
    const daysLeft    = nearestDl
      ? Math.max(1, Math.round((new Date(nearestDl).getTime() - Date.now()) / 86400000))
      : null
    const wordsPerDay = daysLeft ? Math.ceil(Math.max(0, targetWords - totalWords) / daysLeft) : null

    const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

    // Build live context block
    const liveCtx = [
      `TODAY: ${new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}`,

      overdue.length > 0
        ? `⚠ OVERDUE (${overdue.length}):\n` +
          overdue.map(t => `  - [${(t.priority??'').toUpperCase()}] ${t.title} (${t.domain}) — was due ${fmt(t.due_date)}`).join('\n')
        : null,

      dueToday.length > 0
        ? `DUE TODAY: ` + dueToday.map(t => `${t.title} [${t.domain}]`).join(', ')
        : null,

      upcoming.length > 0
        ? `OPEN TASKS: ` + upcoming.slice(0,6).map(t => `${t.title} [${t.priority}/${t.domain}${t.due_date ? ' · ' + fmt(t.due_date) : ''}]`).join('; ')
        : null,

      (modulesR.data ?? []).length > 0
        ? `MODULES: ` + (modulesR.data ?? []).map(m => `${m.title} [${m.status}${m.deadline ? ' · ' + fmt(m.deadline) : ''}]`).join('; ')
        : null,

      chapters.length > 0
        ? `THESIS: ${totalWords.toLocaleString()}/${targetWords.toLocaleString()} words (${Math.round(totalWords/Math.max(targetWords,1)*100)}%)` +
          (wordsPerDay ? ` · ${wordsPerDay.toLocaleString()} words/day needed` : '')
        : null,

      (projectsR.data ?? []).length > 0
        ? `PROJECTS: ` + (projectsR.data ?? []).map(p => `${p.title} ${p.progress ?? 0}% [${p.domain}]`).join('; ')
        : null,

      (notifsR.data ?? []).length > 0
        ? `ALERTS: ` + (notifsR.data ?? []).map(n => `${n.title} [${n.type}]`).join('; ')
        : null,
      execCtxStr || null,
    ].filter(Boolean).join('\n')

    // Include today's brief if it exists — it's the richest single-page summary
    const briefSection = briefR.data?.content
      ? `\nTODAY'S BRIEF:\n${briefR.data.content}`
      : ''

    const domainSection = domainContext
      ? `\nCONVERSATION DOMAIN FOCUS:\n${domainContext}`
      : ''

    // Build training context from exec_intelligence_config
    const trainingCtx = tc ? [
      tc.persona_context && `USER CONTEXT:\n${tc.persona_context}`,
      tc.company_context && `COMPANY CONTEXT:\n${tc.company_context}`,
      tc.goals_context   && `CURRENT GOALS:\n${tc.goals_context}`,
      tc.custom_instructions && `CUSTOM INSTRUCTIONS (follow these precisely):\n${tc.custom_instructions}`,
    ].filter(Boolean).join('\n\n') : ''

    const trainingSection = trainingCtx ? `\n\n${trainingCtx}` : ''

    // Tone/style from training config
    const toneNote = tc?.tone_preference === 'direct'       ? 'Be blunt and direct. Skip preamble.'
                   : tc?.tone_preference === 'consultative' ? 'Use a consultative, questioning tone.'
                   : tc?.tone_preference === 'coaching'     ? 'Use a coaching style — guide rather than tell.'
                   : 'Be professional and concise.'
    const styleNote = tc?.response_style === 'bullets'   ? 'Prefer bullet points over prose.'
                    : tc?.response_style === 'prose'     ? 'Respond in prose paragraphs, no bullet points.'
                    : tc?.response_style === 'brief'     ? 'Keep responses short — 3-5 sentences max unless depth is needed.'
                    : 'Use structured headers and bullet points.'

    const pName = (aiProfile as Record<string,unknown> | null)?.full_name as string ?? 'Douglas'
    const pTitle = (aiProfile as Record<string,unknown> | null)?.job_title as string ?? 'CEO'
    const pOrg   = (aiProfile as Record<string,unknown> | null)?.organisation as string ?? 'VeritasIQ Technologies Ltd'

    const system = `You are PIOS AI — ${pName}'s personal intelligent operating system companion.

USER PROFILE:
- Name: ${pName} | Role: ${pTitle} | Organisation: ${pOrg}
- Persona: ${aiPersona}${trainingSection}

EXECUTIVE OS AWARENESS (when persona is executive/founder/professional):
- EOSA™ executive brief · PAA™ OKR tracking · STIA™ stakeholder CRM
- CSA™ consulting frameworks (7 proprietary) · DAA™ decision architecture
- TSA™ time sovereignty · BICA™ board comms · SIA™ signal intelligence
- All frameworks use PIOS proprietary names — never reference BCG, McKinsey, Porter, Kotter by nameWorking with Claude as primary technical implementer — non-technical founder

TONE & STYLE: ${toneNote} ${styleNote}

BEHAVIOUR RULES:
- Be direct, concise, action-oriented. No pleasantries.
- Reference live data naturally when relevant ("you have 3 overdue tasks", not "according to your data…")
- Spot cross-domain conflicts proactively (DBA deadline clashing with business commitment, etc.)
- When discussing VeritasEdge/InvestiScript/PIOS, you know the technical stack: Next.js 14, TypeScript, Supabase, Python FastAPI, LangGraph, Claude claude-sonnet-4-6
- For DBA research questions, use STS (sociotechnical systems), sensemaking (Weick), TAM/UTAUT as default theoretical frames

LIVE DATA (current as of this message):
${liveCtx}${briefSection}${domainSection}`

    const reply = await callClaude(messages, system, 1200)
    return NextResponse.json({ reply })

  } catch (err: unknown) {
    console.error('AI chat error:', err)
    return NextResponse.json({ error: (err as Error).message ?? 'AI unavailable. Please try again.' }, { status: 500 })
  }
}
