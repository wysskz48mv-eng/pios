// @ts-nocheck
import { apiError } from '@/lib/api-error'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { checkPromptSafety, auditLog, IP_HEADERS } from '@/lib/security-middleware'
import { checkRateLimit, LIMITS } from '@/lib/redis-rate-limit'
import { detectCapabilities, buildCapabilityPrompt } from '@/lib/nemoclaw/capabilities'

// ── Typed Supabase response helpers ──────────────────────────────────────────
type SBResult<T> = { data: T | null; error: { message: string } | null }
type SBRow = Record<string, unknown>


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
 * PIOS v3.0 | VeritasIQ Technologies Ltd
 */
export async function POST(request: Request) {
  try { return await _handleChat(request) } catch (e: unknown) {
    console.error('[PIOS AI FATAL]', e)
    return NextResponse.json({ reply: `Fatal error: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200) }, { status: 200 })
  }
}

async function _handleChat(request: Request) {
  try {
    // Rate limiting — ISO 27001 A.12.6
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    let rl: Response | null = null
    try { rl = await checkRateLimit({ key: `pios:ai:${ip}`, ...LIMITS.ai }) } catch {}
    if (rl) return NextResponse.json({ reply: 'You\'re sending messages too quickly. Please wait a moment.' }, { status: 200 })

    let supabase: any
    try { supabase = createClient() } catch (e) {
      return NextResponse.json({ reply: `Supabase client error: ${(e as Error).message?.slice(0, 100)}` }, { status: 200 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ reply: 'Please sign in to use NemoClaw.' }, { status: 200 })

    let body: any = {}
    try { body = await request.json() } catch { return NextResponse.json({ reply: 'Invalid request.' }, { status: 200 }) }
    const { messages, domainContext } = body
    if (!messages?.length) return NextResponse.json({ reply: 'Please type a message.' }, { status: 200 })

    // IS-POL-008 SSDLC — Prompt injection defence
    const lastMsg = [...messages].reverse().find((m: {role:string}) => m.role === 'user')
    const userText = typeof lastMsg?.content === 'string' ? lastMsg.content : ''
    if (userText) {
      const safety = checkPromptSafety(userText)
      if (!safety.safe) {
        return NextResponse.json({ reply: 'I can\'t process that request. Please rephrase your question.' }, { status: 200 })
      }
    }

    const today = new Date().toISOString().slice(0, 10)

    // Gather live context in parallel
    // Fetch persona first (cheap)
    const { data: aiProfile } = await supabase
      .from('user_profiles').select('persona_type,full_name,job_title,organisation').eq('id', user.id).single()
    const aiPersona = (aiProfile as Record<string,unknown> | null)?.persona_type as string ?? 'individual'
    const aiIsExec  = ['executive','founder','professional'].includes(aiPersona)

    // Fetch training config + NemoClaw calibration in parallel
    const [trainCfgR, nemoCfgR] = await Promise.allSettled([
      (supabase as any)
        .from('exec_intelligence_config')
        .select('persona_context,company_context,goals_context,custom_instructions,tone_preference,response_style')
        .eq('user_id', user.id)
        .maybeSingle(),
      (supabase as any)
        .from('nemoclaw_calibration')
        .select('calibration_summary,seniority_level,primary_industry,career_years,education_detail,recommended_frameworks,growth_areas,communication_register,coaching_intensity')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1),
    ])
    const tc   = trainCfgR.status === 'fulfilled' ? (trainCfgR.value as any).data : null
    const nemo = nemoCfgR.status  === 'fulfilled' ? ((nemoCfgR.value as any).data?.[0] ?? null) as any : null

    const [tasksR, modulesR, projectsR, chaptersR, notifsR, briefR, calendarR] = await Promise.allSettled([
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
      supabase.from('calendar_events').select('title,start_time,end_time,all_day')
        .eq('user_id', user.id)
        .gte('start_time', new Date().toISOString().slice(0,10))
        .lte('start_time', new Date(Date.now() + 86400000).toISOString().slice(0,10))
        .order('start_time').limit(8),
    ])

    const safe = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? (r.value?.data ?? []) : []
    const safeSingle = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? (r.value?.data ?? null) : null
    const tasks    = safe(tasksR)

    // Exec persona — fetch live OKR/decision/stakeholder + wellness + IP + knowledge context
    let execCtxStr = ''
    if (aiIsExec) {
      const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)
      const [okrAiR, decAiR, stakeAiR, wellnessAiR, ipAiR, contractAiR, knowledgeAiR] = await Promise.allSettled([
        supabase.from('exec_okrs').select('title,health,progress').eq('user_id', user.id).eq('status','active').limit(5),
        supabase.from('exec_decisions').select('title,framework_used').eq('user_id', user.id).eq('status','open').limit(4),
        supabase.from('exec_stakeholders').select('name,importance,next_touchpoint')
          .eq('user_id', user.id)
          .lte('next_touchpoint', new Date(Date.now() + 7*86400000).toISOString().split('T')[0])
          .limit(3),
        // Today's wellness state
        supabase.from('wellness_sessions')
          .select('mood_score,energy_score,stress_score,focus_score,dominant_domain,ai_insight')
          .eq('user_id', user.id).eq('session_date', today)
          .order('created_at', { ascending: false }).limit(1),
        // IP vault — frameworks + active assets
        supabase.from('ip_assets')
          .select('name,asset_type,status,renewal_date')
          .eq('user_id', user.id).eq('status', 'active').limit(20),
        // Contracts — active + expiring
        supabase.from('contracts')
          .select('title,contract_type,counterparty,status,end_date,value,currency')
          .eq('user_id', user.id).eq('status', 'active')
          .order('end_date', { ascending: true }).limit(8),
        // Recent knowledge entries
        supabase.from('knowledge_entries')
          .select('title,entry_type,domain,summary')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }).limit(5),
      ])
      const okrAiData     = okrAiR.status     === 'fulfilled' ? (okrAiR.value.data     ?? []) : []
      const decAiData     = decAiR.status     === 'fulfilled' ? (decAiR.value.data     ?? []) : []
      const stakeAiData   = stakeAiR.status   === 'fulfilled' ? (stakeAiR.value.data   ?? []) : []
      const wellnessData  = wellnessAiR.status === 'fulfilled' ? ((wellnessAiR.value as any).data?.[0] ?? null) : null
      const ipData        = ipAiR.status       === 'fulfilled' ? ((ipAiR.value as any).data       ?? []) : []
      const contractData  = contractAiR.status === 'fulfilled' ? ((contractAiR.value as any).data  ?? []) : []
      const knowledgeData = knowledgeAiR.status === 'fulfilled' ? ((knowledgeAiR.value as any).data ?? []) : []

      const okrLines   = (okrAiData   as Record<string,unknown>[]).map(o => `${o.title}: ${o.progress}% (${o.health})`).join(', ')
      const decLines   = (decAiData   as Record<string,unknown>[]).map(d => `${d.title} [${d.framework_used ?? '?'}™]`).join(', ')
      const stakeLines = (stakeAiData as Record<string,unknown>[]).map(s => `${s.name} [${s.importance}]`).join(', ')

      // Wellness line
      const wellnessLine = wellnessData
        ? `TODAY'S WELLNESS: Mood ${wellnessData.mood_score}/10 · Energy ${wellnessData.energy_score}/10 · Stress ${wellnessData.stress_score}/10 · Focus ${wellnessData.focus_score}/10 · Domain focus: ${wellnessData.dominant_domain ?? 'general'}`
        : 'WELLNESS: No check-in today yet'

      // IP vault — frameworks vs other assets
      const frameworks   = (ipData as Record<string,unknown>[]).filter(a => a.asset_type === 'framework')
      const trademarks   = (ipData as Record<string,unknown>[]).filter(a => a.asset_type === 'trademark')
      const renewalsDue  = (ipData as Record<string,unknown>[]).filter(a => a.renewal_date && (a.renewal_date as string) <= in90)
      const ipLine = ipData.length > 0
        ? `IP VAULT (${ipData.length} assets): ${frameworks.length} frameworks (NemoClaw™ suite), ${trademarks.length} trademarks` +
          (renewalsDue.length > 0 ? ` — ⚠ ${renewalsDue.length} renewal(s) due within 90 days` : '')
        : null

      // Active contracts
      const contractLine = contractData.length > 0
        ? `ACTIVE CONTRACTS (${contractData.length}): ` +
          (contractData as Record<string,unknown>[]).slice(0, 4).map(c =>
            `${c.title} [${c.contract_type}/${c.counterparty}${c.end_date ? ' · expires ' + new Date(c.end_date as string).toLocaleDateString('en-GB',{month:'short',year:'numeric'}) : ''}]`
          ).join('; ')
        : null

      // Knowledge entries
      const knowledgeLine = knowledgeData.length > 0
        ? `RECENT KNOWLEDGE: ` + (knowledgeData as Record<string,unknown>[]).map(k => `${k.title} [${k.entry_type}/${k.domain}]`).join('; ')
        : null

      execCtxStr = [
        okrLines   ? `ACTIVE OKRs: ${okrLines}` : null,
        decLines   ? `OPEN DECISIONS: ${decLines}` : null,
        stakeLines ? `STAKEHOLDERS DUE: ${stakeLines}` : null,
        wellnessLine,
        ipLine,
        contractLine,
        knowledgeLine,
      ].filter(Boolean).join('\n')
    }
    const overdue  = tasks.filter(t => t.due_date && t.due_date < today)
    const dueToday = tasks.filter(t => t.due_date === today)
    const upcoming = tasks.filter(t => !t.due_date || t.due_date > today)

    // Thesis velocity
    const chapters    = safe(chaptersR)
    const totalWords  = chapters.reduce((s, c) => s + (c.word_count ?? 0), 0)
    const targetWords = chapters.reduce((s, c) => s + (c.target_words ?? 8000), 0)
    const nearestDl   = (safe(modulesR)).map(m => m.deadline).filter(Boolean).sort()[0]
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

      (safe(modulesR)).length > 0
        ? `MODULES: ` + (safe(modulesR)).map(m => `${m.title} [${m.status}${m.deadline ? ' · ' + fmt(m.deadline) : ''}]`).join('; ')
        : null,

      chapters.length > 0
        ? `THESIS: ${totalWords.toLocaleString()}/${targetWords.toLocaleString()} words (${Math.round(totalWords/Math.max(targetWords,1)*100)}%)` +
          (wordsPerDay ? ` · ${wordsPerDay.toLocaleString()} words/day needed` : '')
        : null,

      (safe(projectsR)).length > 0
        ? `PROJECTS: ` + (safe(projectsR)).map(p => `${p.title} ${p.progress ?? 0}% [${p.domain}]`).join('; ')
        : null,

      (safe(notifsR)).length > 0
        ? `ALERTS: ` + (safe(notifsR)).map(n => `${n.title} [${n.type}]`).join('; ')
        : null,
      safe(calendarR).length > 0
        ? "TODAY'S SCHEDULE (" + String(safe(calendarR).length) + " events): " +
          safe(calendarR).map((e: any) =>
            String(e.title ?? e.summary ?? '') + " @ " + (e.all_day ? 'all-day' : new Date(e.start_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}))
          ).join('; ')
        : null,
      execCtxStr || null,
    ].filter(Boolean).join('\n')

    // Include today's brief if it exists — it's the richest single-page summary
    const briefSection = safeSingle(briefR)?.content
      ? `\nTODAY'S BRIEF:\n${safeSingle(briefR)?.content}`
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

    // NemoClaw calibration block — injected from CV analysis
    const nemoSection = nemo ? [
      `NEMOCLAW™ CALIBRATION PROFILE:`,
      nemo.calibration_summary && `  Summary: ${nemo.calibration_summary}`,
      nemo.seniority_level     && `  Seniority: ${nemo.seniority_level}`,
      nemo.primary_industry    && `  Industry: ${nemo.primary_industry}`,
      nemo.career_years        && `  Experience: ${nemo.career_years} years`,
      nemo.education_detail    && `  Education: ${nemo.education_detail}`,
      nemo.communication_register && `  Communication register: ${nemo.communication_register}`,
      nemo.coaching_intensity  && `  Coaching intensity: ${nemo.coaching_intensity}`,
      nemo.recommended_frameworks?.length && `  Lead frameworks: ${(nemo.recommended_frameworks as string[]).join(', ')}`,
      nemo.growth_areas?.length && `  Growth areas: ${(nemo.growth_areas as string[]).join(', ')}`,
    ].filter(Boolean).join('\n') : ''

    const trainingSection = [
      trainingCtx  ? `\n\n${trainingCtx}`  : '',
      nemoSection  ? `\n\n${nemoSection}`  : '',
    ].join('')

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

    // Detect user capabilities for context-aware responses
    let capabilitySection = ''
    try {
      const caps = await detectCapabilities(supabase, user.id)
      capabilitySection = '\n\n' + buildCapabilityPrompt(caps)
    } catch {}

    const system = `You are PIOS AI — ${pName}'s personal intelligent operating system companion.

USER PROFILE:
- Name: ${pName} | Role: ${pTitle} | Organisation: ${pOrg}
- Persona: ${aiPersona}${trainingSection}
${capabilitySection}

EXECUTIVE OS AWARENESS (when persona is executive/founder/professional):
- EOSA™ executive brief · PAA™ OKR tracking · STIA™ stakeholder CRM
- CSA™ consulting frameworks (7 proprietary) · DAA™ decision architecture
- TSA™ time sovereignty · BICA™ board comms · SIA™ signal intelligence
- All frameworks use PIOS proprietary names — never reference BCG, McKinsey, Porter, Kotter by nameWorking with Claude as primary technical implementer — non-technical founder

TONE & STYLE: ${toneNote} ${styleNote}

BEHAVIOUR RULES:
- Be direct, concise, action-oriented. No pleasantries.
- CRITICAL: You ALREADY HAVE the user's live data below. NEVER say "let me check", "I'll look into", "I need to access" — the data is RIGHT HERE in this prompt. State facts directly: "You have 3 overdue tasks" not "Let me check your tasks".
- If the data shows zero items, say so directly: "You have no overdue tasks" — don't pretend to need to look it up.
- Reference live data naturally and specifically with actual numbers, names, and dates from the LIVE DATA section below.
- Spot cross-domain conflicts proactively (DBA deadline clashing with business commitment, etc.)
- When discussing VeritasEdge/InvestiScript/PIOS, you know the technical stack: Next.js 14, TypeScript, Supabase, Python FastAPI, LangGraph, Claude claude-sonnet-4-6
- For DBA research questions, use STS (sociotechnical systems), sensemaking (Weick), TAM/UTAUT as default theoretical frames

LIVE DATA (current as of this message):
${liveCtx}${briefSection}${domainSection}`

    const rawReply = await callClaude(messages, system, 1200)
    // Output sanitisation — prevent system prompt echo or cross-user data leakage
    const REDACT_SIGNALS = [
      'You are PIOS AI', 'ISO 27001', 'OPERATING PRINCIPLES', 
      'system_prompt', 'NemoClaw calibration block', '[SYSTEM]'
    ]
    const reply = REDACT_SIGNALS.some(s => rawReply.includes(s))
      ? rawReply.replace(/You are PIOS AI[^.]*\./g, '[redacted]')
               .replace(/ISO 27001[^.]*\./g, '[redacted]')
      : rawReply
    return NextResponse.json({ reply })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('AI chat error:', msg)

    // Return specific error for debugging
    if (msg.includes('401') || msg.includes('authentication')) {
      return NextResponse.json({ reply: 'AI service authentication failed. Check ANTHROPIC_API_KEY in Vercel environment variables.' }, { status: 200 })
    }
    if (msg.includes('429') || msg.includes('rate')) {
      return NextResponse.json({ reply: 'AI service rate limited. Please wait a moment and try again.' }, { status: 200 })
    }
    if (msg.includes('timeout') || msg.includes('abort')) {
      return NextResponse.json({ reply: 'AI response timed out. Try a shorter message or try again.' }, { status: 200 })
    }
    return NextResponse.json({ reply: `AI temporarily unavailable: ${msg.slice(0, 100)}. Please try again.` }, { status: 200 })
  }
}
