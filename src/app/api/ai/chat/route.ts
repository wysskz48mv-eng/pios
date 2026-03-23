import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { checkPromptSafety, auditLog, IP_HEADERS } from '@/lib/security-middleware'

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
    ].filter(Boolean).join('\n')

    // Include today's brief if it exists — it's the richest single-page summary
    const briefSection = briefR.data?.content
      ? `\nTODAY'S BRIEF:\n${briefR.data.content}`
      : ''

    const domainSection = domainContext
      ? `\nCONVERSATION DOMAIN FOCUS:\n${domainContext}`
      : ''

    const system = `You are PIOS AI — Douglas Masuku's personal intelligent operating system companion.

DOUGLAS'S PROFILE:
- Group CEO, VeritasIQ Technologies Ltd (UAE/UK holding company)
- DBA candidate, University of Portsmouth (AI-enabled forecasting in GCC FM contexts; STS + sensemaking theory)
- FM consultant — Qiddiya RFP QPMO-410-CT-07922 active, KSP reference deployment SAR 229.6M annual SC budget
- SaaS founder:
    · VeritasEdge™ v6.0 — service charge platform for GCC master communities (live at app.veritasedge.io)
    · InvestiScript™ v3.5 — AI investigative journalism platform (live at app.investiscript.ai)
    · PIOS v2.2 — this personal AI operating system (live at pios-*.vercel.app)
- Key IP: HDCA™ (patent pending), VE-CAFX™ climate adjustment factors, VE-PMF™ methodology, VE-BENCH™ benchmarking
- Working with Claude as primary technical implementer — non-technical founder

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
    return NextResponse.json({ error: err.message ?? 'AI unavailable. Please try again.' }, { status: 500 })
  }
}
