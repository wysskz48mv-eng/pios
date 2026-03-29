import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/coaching/session
 * NemoClaw™ Coaching Session API
 *
 * Actions:
 *   start   → creates session, loads context, sends opening question
 *   message → continues session, maintains conversation
 *   end     → closes session, extracts insights, updates profile
 *
 * Each mode has a distinct coaching contract:
 *   daily_reflection → 3 questions from yesterday's activity
 *   situation_prep   → structured preparation for named event
 *   role_play        → NemoClaw plays a counterparty persona
 *   debrief          → post-event processing (what happened, learning)
 *   deep             → structured theme exploration (30-45 min)
 *
 * VeritasIQ Technologies Ltd · PIOS Sprint K+1
 */

export const dynamic     = 'force-dynamic'
export const maxDuration = 30

type CoachMode = 'daily_reflection' | 'situation_prep' | 'role_play' | 'debrief' | 'deep'

/* ── Mode contracts ─────────────────────────────────────────── */
const MODE_CONTRACTS: Record<CoachMode, { questions: number; style: string }> = {
  daily_reflection: { questions: 3, style: 'reflective, warm, draws from yesterday' },
  situation_prep:   { questions: 5, style: 'structured, preparation-focused, practical' },
  role_play:        { questions: 0, style: 'in-character counterparty, challenging but fair' },
  debrief:          { questions: 4, style: 'curious, non-judgmental, learning-focused' },
  deep:             { questions: 8, style: 'exploratory, challenging assumptions, insight-generating' },
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { action, session_id, mode, message, context, rating } = body

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  /* ── ACTION: START ────────────────────────────────────────── */
  if (action === 'start') {
    const ctx = await loadCoachingContext(user.id, admin)
    const openingPrompt = buildOpeningPrompt(mode as CoachMode, ctx, context)

    const msg = await client.messages.create({
      model:      'claude-sonnet-4-5-20251001',
      max_tokens: 400,
      system:     buildSystemPrompt(mode as CoachMode, ctx),
      messages:   [{ role: 'user', content: openingPrompt }],
    })

    const openingMessage = msg.content[0].type === 'text' ? msg.content[0].text : ''

    // Create session record
    const { data: session } = await admin.from('coaching_sessions').insert({
      user_id:      user.id,
      mode,
      title:        buildSessionTitle(mode as CoachMode, context),
      session_date: new Date().toISOString().split('T')[0],
      messages:     [
        { role: 'system', content: openingPrompt, ts: new Date().toISOString() },
        { role: 'coach', content: openingMessage, ts: new Date().toISOString() },
      ],
      created_at:   new Date().toISOString(),
    }).select('id').single()

    return NextResponse.json({ session_id: session?.id, message: openingMessage })
  }

  /* ── ACTION: MESSAGE ──────────────────────────────────────── */
  if (action === 'message' && session_id) {
    const { data: session } = await admin.from('coaching_sessions')
      .select('*').eq('id', session_id).eq('user_id', user.id).single()
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const ctx         = await loadCoachingContext(user.id, admin)
    const history     = (session.messages as {role:string;content:string}[]) ?? []
    const userCount   = history.filter(m => m.role === 'user').length + 1
    const contract    = MODE_CONTRACTS[session.mode as CoachMode]
    const isLastQuestion = userCount >= contract.questions && contract.questions > 0

    // Build conversation history for Claude
    const claudeMessages = history
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role === 'coach' ? 'assistant' as const : 'user' as const, content: m.content }))
    claudeMessages.push({ role: 'user', content: message })

    // Add session-complete instruction on last question
    const systemExtra = isLastQuestion
      ? '\n\nThis is the final question in this session. After the user responds, give a brief synthesis of the key insights from this session (2-3 sentences). Then write exactly "---SESSION_COMPLETE---" on its own line.'
      : ''

    const msg = await client.messages.create({
      model:      'claude-sonnet-4-5-20251001',
      max_tokens: 500,
      system:     buildSystemPrompt(session.mode as CoachMode, ctx) + systemExtra,
      messages:   claudeMessages,
    })

    const coachReply    = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const sessionComplete = coachReply.includes('---SESSION_COMPLETE---')
    const cleanReply    = coachReply.replace('---SESSION_COMPLETE---', '').trim()

    // Update session with new messages
    const updatedMessages = [
      ...history,
      { role: 'user',  content: message,    ts: new Date().toISOString() },
      { role: 'coach', content: cleanReply, ts: new Date().toISOString() },
    ]

    await admin.from('coaching_sessions').update({
      messages:    updatedMessages,
      updated_at:  new Date().toISOString(),
    }).eq('id', session_id)

    return NextResponse.json({ message: cleanReply, session_complete: sessionComplete })
  }

  /* ── ACTION: END ──────────────────────────────────────────── */
  if (action === 'end' && session_id) {
    const { data: session } = await admin.from('coaching_sessions')
      .select('*').eq('id', session_id).eq('user_id', user.id).single()
    if (!session) return NextResponse.json({ ok: true })

    const history = (session.messages as {role:string;content:string}[]) ?? []
    const fullText = history.map(m => `${m.role}: ${m.content}`).join('\n')

    // Extract insights and themes
    const extractMsg = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Extract from this coaching session:
1. Key insights (max 3, one sentence each)
2. Themes (max 3, 2-3 words each)
3. Session title (6 words max)

Session:
${fullText.slice(0, 3000)}

Respond JSON only:
{"insights":["..."],"themes":["..."],"title":"...","summary":"2-sentence summary"}`
      }],
    })

    let insights: string[] = [], themes: string[] = [], title = '', summary = ''
    try {
      const text  = extractMsg.content[0].type === 'text' ? extractMsg.content[0].text : '{}'
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      insights = (parsed as any).insights ?? []
      themes   = (parsed as any).themes   ?? []
      title    = parsed.title    ?? session.mode
      summary  = parsed.summary  ?? ''
    } catch { /* non-fatal */ }

    // Calculate duration
    const messages       = (session.messages as {ts:string}[]) ?? []
    const startTs        = messages[0]?.ts ? new Date(messages[0].ts) : new Date()
    const durationMin    = Math.round((Date.now() - startTs.getTime()) / 60000)

    await admin.from('coaching_sessions').update({
      title,
      insights,
      themes,
      summary,
      user_rating:      rating ?? null,
      duration_minutes: durationMin,
      updated_at:       new Date().toISOString(),
    }).eq('id', session_id)

    // Update coaching profile (every 5th session)
    const { count } = await admin.from('coaching_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if (count && count % 5 === 0) {
      await updateCoachingProfile(user.id, admin, client)
    }

    return NextResponse.json({ ok: true, title, themes, summary })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

/* ── Load coaching context ──────────────────────────────────── */
async function loadCoachingContext(userId: string, admin: any) {
  const [calibRes, okrRes, decRes, stakeRes, sessionRes] = await Promise.allSettled([
    admin.from('nemoclaw_calibration').select('calibration_summary,seniority_level,primary_industry,communication_register').eq('user_id', userId).single(),
    admin.from('executive_okrs').select('objective,progress,status').eq('user_id', userId).eq('status','active').limit(3),
    admin.from('executive_decisions').select('title,context').eq('user_id', userId).eq('status','open').limit(3),
    admin.from('stakeholders').select('name,organisation,role').eq('user_id', userId).limit(8),
    admin.from('coaching_sessions').select('themes,insights').eq('user_id', userId).order('created_at',{ascending:false}).limit(5),
  ])

  return {
    calib:      calibRes.status      === 'fulfilled' ? calibRes.value.data      : null,
    okrs:       okrRes.status        === 'fulfilled' ? okrRes.value.data        : [],
    decisions:  decRes.status        === 'fulfilled' ? decRes.value.data        : [],
    stakeholders: stakeRes.status    === 'fulfilled' ? stakeRes.value.data      : [],
    recentSessions: sessionRes.status=== 'fulfilled' ? sessionRes.value.data    : [],
  }
}

/* ── System prompt ──────────────────────────────────────────── */
function buildSystemPrompt(mode: CoachMode, ctx: Awaited<ReturnType<typeof loadCoachingContext>>): string {
  const { calib, okrs, decisions, stakeholders, recentSessions } = ctx

  const recentThemes = (recentSessions as {themes:string[]}[]).flatMap((s: any) => (s as any).themes ?? []).slice(0, 6).join(', ')
  const stakeList    = (stakeholders as {name:string;organisation:string}[]).map(s => `${s.name} (${s.organisation})`).join(', ')
  const okrList      = (okrs as {objective:string;progress:number}[]).map(o => `${o.objective} (${o.progress}%)`).join('; ')
  const decList      = (decisions as {title:string}[]).map(d => d.title).join('; ')

  return `You are NemoClaw™, an executive coaching AI for a ${(calib as any)?.seniority_level ?? 'senior'} professional in ${(calib as any)?.primary_industry ?? 'consulting'}.

COACHING PROFILE:
${(calib as any)?.calibration_summary ?? 'Experienced professional'}

CURRENT CONTEXT:
Active OKRs: ${okrList || 'None logged'}
Open decisions: ${decList || 'None logged'}
Key stakeholders: ${stakeList || 'None logged'}
Recent coaching themes: ${recentThemes || 'First session'}

COACHING MODE: ${mode.replace('_', ' ')}
STYLE: ${MODE_CONTRACTS[mode].style}

COACHING PRINCIPLES:
- Ask powerful questions — never give advice unless explicitly asked
- Draw from the user's actual context (their OKRs, stakeholders, decisions)
- One question at a time — never stack questions
- Reflect back what you hear before probing deeper
- Use their communication register: ${(calib as any)?.communication_register ?? 'professional'}
- UK English, British spellings
- Be direct and concise — this is executive coaching, not therapy
- Never be sycophantic — challenge respectfully when the thinking is unclear
- When doing role-play: stay fully in character as the counterparty`
}

/* ── Opening prompts by mode ────────────────────────────────── */
function buildOpeningPrompt(mode: CoachMode, ctx: Awaited<ReturnType<typeof loadCoachingContext>>, context?: string): string {
  const okr = (ctx.okrs as {objective:string;progress:number}[])[0]

  switch (mode) {
    case 'daily_reflection':
      return `Open a daily reflection coaching session. Start with one grounding question about yesterday${okr ? `, drawing from their OKR: "${okr.objective}" (${okr.progress}% progress)` : ''}. One question only.`

    case 'situation_prep':
      return `The user wants to prepare for: "${context ?? 'an upcoming situation'}". Open with a question to understand what's at stake for them personally. One question only.`

    case 'role_play':
      return `The user wants to role-play a scenario. They want you to play: "${context ?? 'a challenging stakeholder'}". Briefly introduce yourself as the character in 1-2 sentences, then open the conversation as that person would. Stay in character.`

    case 'debrief':
      return `Open a post-event debrief. Start with a simple, open question about what happened. One question only. Keep it light — you don't know yet if the event went well or badly.`

    case 'deep':
      return `Open a deep coaching session. Based on their recent themes${((ctx.recentSessions ?? []) ?? []).length > 0 ? ' from past sessions' : ''}, identify the most promising area to explore. Open with a powerful question about something that matters to their growth. One question only.`

    default:
      return 'Open the coaching session with a grounding question. One question only.'
  }
}

/* ── Session title builder ──────────────────────────────────── */
function buildSessionTitle(mode: CoachMode, context?: string): string {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const labels: Record<CoachMode, string> = {
    daily_reflection: `Reflection · ${date}`,
    situation_prep:   `Prep: ${context?.slice(0, 30) ?? 'upcoming event'} · ${date}`,
    role_play:        `Role-play: ${context?.slice(0, 25) ?? 'stakeholder'} · ${date}`,
    debrief:          `Debrief · ${date}`,
    deep:             `Deep session · ${date}`,
  }
  return labels[mode]
}

/* ── Update coaching profile (every 5 sessions) ─────────────── */
async function updateCoachingProfile(
  userId: string,
  admin: any,
  client: Anthropic
): Promise<void> {
  try {
    const { data: sessions } = await admin.from('coaching_sessions')
      .select('themes,insights,summary').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(20)

    if (!sessions?.length) return

    const allInsights = sessions.flatMap((s: any) => (s as any).insights ?? []).join('\n')
    const allThemes   = sessions.flatMap(s => (s as any).themes   ?? [])
    const themeCounts: Record<string, number> = {}
    for (const t of allThemes) themeCounts[t] = (themeCounts[t] ?? 0) + 1

    const msg = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Analyse these coaching session insights and identify patterns.

INSIGHTS FROM ${sessions.length} SESSIONS:
${allInsights.slice(0, 3000)}

THEME FREQUENCY:
${Object.entries(themeCounts).sort((a,b) => b[1]-a[1]).map(([t,c]) => `${t}: ${c}`).join(', ')}

Return JSON only:
{
  "strengths": [{"theme":"...","evidence":"one sentence"}],
  "recurring_themes": [{"theme":"...","count":0}],
  "growth_edges": [{"area":"...","progress":"one sentence"}]
}`
      }],
    })

    const text   = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())

    await admin.from('coaching_profile').upsert({
      user_id:          userId,
      strengths:        parsed.strengths        ?? [],
      recurring_themes: parsed.recurring_themes ?? [],
      growth_edges:     parsed.growth_edges     ?? [],
      session_count:    sessions.length,
      last_updated:     new Date().toISOString(),
    }, { onConflict: 'user_id' })

  } catch (err) {
    console.error('[coaching profile update]', err)
  }
}
