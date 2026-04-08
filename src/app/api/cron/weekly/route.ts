/**
 * GET /api/cron/weekly
 * Vercel Cron — runs every Sunday at 08:00 UTC (10:00 UAE / 09:00 UK)
 *
 * Generates and emails a weekly digest for every active PIOS user.
 * Aggregates the previous 7 days (Mon–Sun):
 *   - Tasks completed vs overdue
 *   - Thesis word-count delta (words written this week)
 *   - Expenses logged + total
 *   - Academic modules updated
 *   - FM news headlines (last 7 days, top 3 by relevance)
 *   - AI-generated one-sentence insight (Claude, non-blocking)
 *
 * Idempotent: re-running on the same Sunday re-sends with fresh data.
 * Never throws — each user is wrapped in try/catch.
 *
 * PIOS v3.0 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import { callClaude }                from '@/lib/ai/client'
import { requireCronSecret }         from '@/lib/security/route-guards'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'
import {
  sendEmail,
  weeklyDigestHtml,
  weeklyDigestText,
  type WeeklyDigestData,
} from '@/lib/email/resend'

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 300

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** ISO week window: last 7 days (Mon 00:00 → Sun 23:59 in UTC) */
function weekWindow(): { from: string; to: string; label: string } {
  const now  = new Date()
  const to   = new Date(now)
  // go back to last Monday
  const day  = now.getUTCDay() // 0=Sun
  const diff = day === 0 ? 6 : day - 1   // days since last Mon
  const from = new Date(now)
  from.setUTCDate(now.getUTCDate() - diff)
  from.setUTCHours(0, 0, 0, 0)
  to.setUTCHours(23, 59, 59, 999)

  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return {
    from:  from.toISOString(),
    to:    to.toISOString(),
    label: `${fmt(from)} – ${fmt(to)}`,
  }
}

/** Format currency amount. */
function fmtAmount(total: number, currency: string): string {
  const sym: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', AED: 'د.إ', SAR: '﷼' }
  const s = sym[currency] ?? currency + ' '
  return `${s}${total.toFixed(2)}`
}

export async function GET(req: NextRequest) {
  const authErr = requireCronSecret(req)
  if (authErr) return authErr

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const win   = weekWindow()
  const start = Date.now()

  // Fetch all active profiles
  const { data: profiles, error: profErr } = await admin
    .from('user_profiles')
    .select('id, full_name, billing_email, google_email')
    .limit(100)

  if (profErr || !profiles) {
    console.error('[cron/weekly] Failed to fetch profiles:', profErr)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  let sent = 0, failed = 0

  for (const profile of profiles) {
    const uid   = profile.id
    const email = profile.billing_email ?? profile.google_email
    if (!email) continue

    try {
      // ── Parallel data fetch ─────────────────────────────────────────────
      const [
        tasksDone,
        tasksOverdue,
        thesisNow,
        thesisPrev,
        expenses,
        modules,
        fmNews,
        okrsWeekly,
        wellnessWeek,
        ipRenew30,
        ctRenew30,
      ] = await Promise.all([
        // Tasks completed this week
        admin.from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('status', 'done')
          .gte('updated_at', win.from)
          .lte('updated_at', win.to),

        // Tasks currently overdue
        admin.from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid)
          .neq('status', 'done')
          .lt('due_date', new Date().toISOString().slice(0, 10)),

        // Thesis chapters — current word counts
        admin.from('thesis_chapters')
          .select('word_count')
          .eq('user_id', uid),

        // Previous week snapshot (for word delta)
        admin.from('thesis_weekly_snapshots')
          .select('total_words')
          .eq('user_id', uid)
          .lt('week_start', String(win.from ?? "").slice(0, 10))
          .order('week_start', { ascending: false })
          .limit(1),

        // Expenses logged this week
        admin.from('expenses')
          .select('amount, currency')
          .eq('user_id', uid)
          .gte('date', String(win.from ?? "").slice(0, 10))
          .lte('date', String(win.to ?? "").slice(0, 10)),

        // Academic modules updated this week
        admin.from('academic_modules')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid)
          .gte('updated_at', win.from)
          .lte('updated_at', win.to),

        // FM news this week (top 3 by relevance)
        admin.from('fm_news_items')
          .select('headline')
          .eq('user_id', uid)
          .gte('created_at', win.from)
          .order('relevance', { ascending: false })
          .limit(3),

        // Executive OKRs (health + progress for weekly review)
        admin.from('exec_okrs')
          .select('title,health,progress,period')
          .eq('user_id', uid)
          .eq('status', 'active')
          .order('health')
          .limit(6),

        // Wellness check-ins this week
        (admin as any).from('wellness_sessions')
          .select('mood_score,energy_score,stress_score,focus_score,session_date')
          .eq('user_id', uid)
          .gte('session_date', String(win.from ?? '').slice(0, 10))
          .lte('session_date', String(win.to ?? '').slice(0, 10))
          .order('session_date'),

        // IP + contract renewals due next 30 days (weekly urgency window)
        (admin as any).from('ip_assets')
          .select('name,asset_type,renewal_date')
          .eq('user_id', uid).eq('status', 'active')
          .gte('renewal_date', new Date().toISOString().slice(0, 10))
          .lte('renewal_date', new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
          .order('renewal_date').limit(3),
        (admin as any).from('contracts')
          .select('title,contract_type,end_date')
          .eq('user_id', uid).eq('status', 'active')
          .gte('end_date', new Date().toISOString().slice(0, 10))
          .lte('end_date', new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
          .order('end_date').limit(3),
      ])

      const totalWords   = (thesisNow.data ?? []).reduce((s: number, c: unknown) => s + ((c as any)?.word_count ?? 0), 0)
      const prevWords    = (thesisPrev.data?.[0] as Record<string,unknown>)?.total_words ?? null
      const wordsWritten = prevWords !== null ? Math.max(0, Number(totalWords ?? 0) - Number(prevWords ?? 0)) : 0

      // Capture this week's snapshot (upsert — idempotent)
      const weekStart = String(win.from ?? "").slice(0, 10)
      await admin.from('thesis_weekly_snapshots').upsert({
        user_id:       uid,
        week_start:    weekStart,
        total_words:   totalWords,
        chapter_count: (thesisNow.data ?? []).length,
        captured_at:   new Date().toISOString(),
      // @ts-ignore — supabase v2: .catch() absent from type defs
      }, { onConflict: 'user_id,week_start' }) // non-fatal

      const expList      = expenses.data ?? []
      const expTotal     = expList.reduce((s: number, e: unknown) => s + Number((e as any)?.amount ?? 0), 0)
      const expCurrency  = expList[0]?.currency ?? 'GBP'

      const headlines    = (fmNews.data ?? []).map((r: Record<string, unknown>) => String(r.headline ?? ''))
      const okrList      = ((okrsWeekly as any)?.data ?? []) as any[]
      const atRiskOkrs   = okrList.filter((o: any) => o.health === 'at_risk' || o.health === 'off_track')

      // Wellness week stats
      const wellnessSessions = ((wellnessWeek as any)?.data ?? []) as any[]
      const wellnessCheckins = wellnessSessions.length
      const avgMoodWeek   = wellnessCheckins ? Math.round(wellnessSessions.reduce((s: number, w: any) => s + (w.mood_score ?? 5), 0) / wellnessCheckins * 10) / 10 : null
      const avgEnergyWeek = wellnessCheckins ? Math.round(wellnessSessions.reduce((s: number, w: any) => s + (w.energy_score ?? 5), 0) / wellnessCheckins * 10) / 10 : null
      const avgStressWeek = wellnessCheckins ? Math.round(wellnessSessions.reduce((s: number, w: any) => s + (w.stress_score ?? 5), 0) / wellnessCheckins * 10) / 10 : null
      const ipRenew30Days = ((ipRenew30 as any)?.data ?? []) as any[]
      const ctRenew30Days = ((ctRenew30 as any)?.data ?? []) as any[]

      // ── AI insight (non-blocking, skip on error) ─────────────────────────
      let topInsight = ''
      try {
        const renewalNote = (ipRenew30Days.length + ctRenew30Days.length) > 0 
          ? `, ${ipRenew30Days.length + ctRenew30Days.length} renewal(s) due within 30 days` : ''
        const wellnessNote = avgMoodWeek !== null
          ? `, avg mood=${avgMoodWeek} energy=${avgEnergyWeek} stress=${avgStressWeek} (${wellnessCheckins} check-ins)` : ''
        const insightPrompt = `You are PIOS, a personal intelligence operating system. Write ONE short, specific, actionable sentence (max 25 words) as a weekly insight for ${profile.full_name?.split(' ')[0] ?? 'the user'} based on: tasks completed=${tasksDone.count ?? 0}, overdue=${tasksOverdue.count ?? 0}, thesis words=${totalWords}, expenses=${expList.length}, OKRs active=${okrList.length} (${atRiskOkrs.length} at risk)${wellnessNote}${renewalNote}. Be encouraging but honest. No filler phrases.`
        const resp = await callClaude([{ role: 'user', content: insightPrompt }], 'You are a concise, motivating weekly advisor. Output only the insight sentence — no quotes, no preamble.', 60)
        topInsight = resp.trim()
      } catch { /* non-blocking */ }

      // ── Build digest data ─────────────────────────────────────────────────
      const digestData: WeeklyDigestData = {
        userName:         profile.full_name ?? 'there',
        weekLabel:        win.label,
        tasksCompleted:   tasksDone.count   ?? 0,
        tasksOverdue:     tasksOverdue.count ?? 0,
        wordsWritten,
        totalThesisWords: totalWords,
        expensesLogged:   expList.length,
        expensesTotal:    expList.length > 0 ? fmtAmount(expTotal, expCurrency) : '£0.00',
        modulesUpdated:   modules.count ?? 0,
        fmHeadlines:      headlines,
        topInsight,
        okrCount:         okrList.length,
        okrAtRisk:        atRiskOkrs.length,
        okrHighlights:    okrList.slice(0, 3).map((o: any) => `${o.title}: ${o.progress ?? 0}% (${o.health ?? 'unknown'})`),
      }

      // ── Send email ────────────────────────────────────────────────────────
      const result = await sendEmail({
        to:      email,
        subject: `Your PIOS weekly digest — ${win.label}`,
        html:    weeklyDigestHtml(digestData),
        text:    weeklyDigestText(digestData),
      })

      if (result.ok) {
        sent++

      } else {
        failed++
        console.warn(`[cron/weekly] ✗ ${profile.full_name ?? uid}: ${result.error}`)
      }

    } catch (err: unknown) {
      failed++
      console.error(`[cron/weekly] ✗✗ ${uid}:`, (err as Error).message)
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  return NextResponse.json({ ok: true, sent, failed, elapsed_s: Number(elapsed), week: win.label })
}
