// @ts-nocheck
/**
 * GET  /api/cos/daily-brief  — today's AI-generated executive brief
 * POST /api/cos/daily-brief  — force-regenerate brief
 *
 * Lightweight morning brief (Claude Haiku 4.5) — fast daily scan:
 * overdue tasks, today's meetings, IP alerts, platform health, Qiddiya deadline.
 * Designed to run at 07:00 UTC via CRON and cache result for the day.
 *
 * PIOS™ v3.5.1 | Sprint L — Daily Brief | VeritasIQ Technologies Ltd
 */
import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { callClaude }                from '@/lib/ai/client'

export const dynamic    = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const today     = new Date().toISOString().slice(0, 10)
    const tomorrow  = new Date(Date.now() + 86400_000).toISOString().slice(0, 10)
    const in7       = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10)
    const daysToQ   = Math.max(0, Math.ceil((new Date('2026-04-14').getTime() - Date.now()) / 86400_000))

    // Check for today's cached brief
    const { data: cached } = await supabase
      .from('daily_briefs')
      .select('brief_text,generated_at,state_snapshot')
      .eq('user_id', user.id)
      .eq('brief_date', today)
      .single()

    if (cached?.brief_text) {
      return NextResponse.json({
        ok: true, brief_text: cached.brief_text,
        generated_at: cached.generated_at,
        state_snapshot: cached.state_snapshot,
        cached: true, brief_date: today,
      })
    }

    // Generate fresh brief
    return await generateBrief(supabase, user.id, today, tomorrow, in7, daysToQ)
  } catch (err: any) {
    console.error('[PIOS daily-brief GET]', err)
    return apiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const today   = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10)
    const in7     = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10)
    const daysToQ = Math.max(0, Math.ceil((new Date('2026-04-14').getTime() - Date.now()) / 86400_000))

    // Delete cached version and regenerate
    await supabase.from('daily_briefs').delete().eq('user_id', user.id).eq('brief_date', today)
    return await generateBrief(supabase, user.id, today, tomorrow, in7, daysToQ)
  } catch (err: any) {
    console.error('[PIOS daily-brief POST]', err)
    return apiError(err)
  }
}

async function generateBrief(supabase: any, userId: string, today: string, tomorrow: string, in7: string, daysToQ: number) {
  // Parallel fetch all relevant state
  const [tasks, meetings, ipAssets, chapters, insights, agents] = await Promise.all([
    supabase.from('tasks').select('id,title,priority,status,due_date,category')
      .eq('user_id', userId).in('status', ['todo','in_progress'])
      .order('due_date', { ascending: true }).limit(20),
    supabase.from('meeting_notes').select('id,title,created_at,ai_action_items')
      .eq('user_id', userId).gte('created_at', today + 'T00:00:00').limit(5),
    supabase.from('ip_assets').select('id,name,asset_type,renewal_date,status')
      .eq('user_id', userId).eq('status', 'active').lte('renewal_date', in7),
    supabase.from('thesis_chapters').select('id,chapter_num,title,status,word_count,target_words')
      .eq('user_id', userId).limit(8),
    supabase.from('insights').select('id,content,category,created_at')
      .eq('user_id', userId).gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString()).limit(3),
    supabase.from('user_agents').select('agent_id,enabled,last_run_status')
      .eq('user_id', userId).eq('enabled', true),
  ])

  const overdue   = (tasks.data ?? []).filter((t: any) => t.due_date && t.due_date < today)
  const dueToday  = (tasks.data ?? []).filter((t: any) => t.due_date === today || t.due_date === tomorrow)
  const urgent    = (tasks.data ?? []).filter((t: any) => t.priority === 'urgent' && t.due_date <= in7)
  const ipAlerts  = (ipAssets.data ?? [])
  const todayMtgs = (meetings.data ?? [])

  // Chapter progress
  const totalW  = (chapters.data ?? []).reduce((s: number, c: any) => s + (c.word_count ?? 0), 0)
  const targetW = (chapters.data ?? []).reduce((s: number, c: any) => s + (c.target_words ?? 8000), 0)
  const dbaProgress = targetW > 0 ? Math.round(totalW / targetW * 100) : 0

  // Build context string for AI
  const context = [
    `DATE: ${today} | QIDDIYA DEADLINE: ${daysToQ} days (14 Apr 2026)`,
    `DBA PROGRESS: ${dbaProgress}% (${totalW.toLocaleString()}/${targetW.toLocaleString()} words)`,
    overdue.length   ? `OVERDUE TASKS (${overdue.length}): ${overdue.slice(0,4).map((t:any)=>t.title).join(' | ')}` : '',
    dueToday.length  ? `DUE TODAY (${dueToday.length}): ${dueToday.slice(0,3).map((t:any)=>t.title).join(' | ')}` : '',
    urgent.length    ? `URGENT THIS WEEK (${urgent.length}): ${urgent.slice(0,3).map((t:any)=>t.title).join(' | ')}` : '',
    todayMtgs.length ? `TODAY'S MEETINGS (${todayMtgs.length}): ${todayMtgs.map((m:any)=>m.title).join(' | ')}` : '',
    ipAlerts.length  ? `IP ALERTS: ${ipAlerts.map((a:any)=>`${a.name} renews ${a.renewal_date}`).join(' | ')}` : '',
    (insights.data ?? []).length ? `NEW INSIGHTS (last 24h): ${(insights.data ?? []).slice(0,2).map((i:any)=>String(i.content).slice(0,60)).join(' | ')}` : '',
    `ACTIVE AGENTS: ${(agents.data ?? []).length}`,
  ].filter(Boolean).join('\n')

  const brief_text = await callClaude(
    [{ role: 'user', content:
      `PIOS Chief of Staff. Generate today's morning executive brief for Dimitry Masuku, CEO/Founder VeritasIQ + DBA candidate.\n\n` +
      `STATE:\n${context}\n\n` +
      `Write a structured brief (max 250 words):\n` +
      `⚡ TODAY'S PRIORITY (1 item — the single most important thing)\n` +
      `📋 ACTION ITEMS (3-4 bullets — specific, named tasks)\n` +
      `⚠ WATCH ITEMS (1-2 — things at risk or needing attention)\n` +
      `📅 DEADLINE PULSE (Qiddiya + DBA progress in one sentence)\n\n` +
      `Be direct. Use names. No padding. CEO voice.`
    }],
    'You are the PIOS Chief of Staff. Produce concise executive briefings with clear priorities, actions, and risks.',
    500,
    'haiku'
  )
  const state_snapshot = { overdue: overdue.length, due_today: dueToday.length, ip_alerts: ipAlerts.length, dba_progress: dbaProgress, days_to_qiddiya: daysToQ }

  // Cache to DB
  await supabase.from('daily_briefs').upsert({
    user_id: userId, brief_date: today, brief_text,
    generated_at: new Date().toISOString(),
    state_snapshot,
  }, { onConflict: 'user_id,brief_date' })

  return NextResponse.json({
    ok: true, brief_text, generated_at: new Date().toISOString(),
    state_snapshot, cached: false, brief_date: today,
  })
}
