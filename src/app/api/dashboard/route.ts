import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/dashboard
 * Aggregates all data for the dashboard KPI strip + cards.
 * Single call replaces 6+ individual fetches on page load.
 *
 * Returns:
 *   tasks:     { total, overdue, due_today, high_priority }
 *   okrs:      { total, on_track, at_risk, avg_progress }
 *   decisions: { total, open, pending_review }
 *   wellness:  { streak, today_logged, last_score }
 *   financial: { revenue, burn, runway, period }
 *   brief:     { content, brief_date, exists } — today's brief if generated
 *   profile:   { full_name, plan, ai_calls_used, ai_calls_limit, onboarded }
 *   ip:        { total_assets, expiring_soon }
 *
 * All sections degrade gracefully — missing tables return null, not 500.
 * VeritasIQ Technologies Ltd · PIOS
 */

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const uid = user.id

    // Run all queries in parallel — each wrapped to never throw
    const [
      tasksResult,
      okrsResult,
      decisionsResult,
      wellnessResult,
      financialResult,
      briefResult,
      profileResult,
      ipResult,
      creditsResult,
    ] = await Promise.allSettled([

      // Tasks
      supabase.from('tasks')
        .select('id,status,priority,due_date')
        .eq('user_id', uid)
        .neq('status', 'done'),

      // OKRs
      supabase.from('okrs')
        .select('id,progress_pct,health')
        .eq('user_id', uid),

      // Decisions
      supabase.from('decisions')
        .select('id,status')
        .eq('user_id', uid),

      // Wellness streak
      supabase.from('wellness_streaks')
        .select('current_streak,last_activity_date')
        .eq('user_id', uid)
        .single(),

      // Latest financial snapshot
      supabase.from('financial_snapshots')
        .select('revenue_gbp,burn_gbp,runway_months,period')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),

      // Today's brief
      supabase.from('morning_briefs')
        .select('summary_text,brief_date,created_at')
        .eq('user_id', uid)
        .eq('brief_date', todayStr)
        .single(),

      // User profile + plan
      supabase.from('user_profiles')
        .select('full_name,plan,persona_type,onboarded,cv_processing_status')
        .eq('id', uid)
        .single(),

      // IP assets expiring
      supabase.from('ip_assets')
        .select('id,expiry_date')
        .eq('user_id', uid)
        .eq('status', 'active'),

      // AI credits
      supabase.from('exec_intelligence_config')
        .select('ai_calls_used,ai_calls_limit')
        .eq('user_id', uid)
        .single(),
    ])

    // ── Process tasks ──────────────────────────────────────────────────────
    const tasks = tasksResult.status === 'fulfilled'
      ? tasksResult.value.data ?? []
      : []
    const overdue = tasks.filter((t: Record<string, string>) =>
      t.due_date && new Date(t.due_date) < today
    ).length
    const dueToday = tasks.filter((t: Record<string, string>) =>
      t.due_date?.startsWith(todayStr)
    ).length
    const highPriority = tasks.filter((t: Record<string, string>) =>
      t.priority === 'high'
    ).length

    // ── Process OKRs ───────────────────────────────────────────────────────
    const okrs = okrsResult.status === 'fulfilled'
      ? okrsResult.value.data ?? []
      : []
    const onTrack  = okrs.filter((o: Record<string, string>) => o.health === 'on_track').length
    const atRisk   = okrs.filter((o: Record<string, string>) =>
      ['at_risk', 'off_track'].includes(o.health)
    ).length
    const avgProgress = okrs.length > 0
      ? Math.round(okrs.reduce((s: number, o: Record<string, number>) => s + (o.progress_pct ?? 0), 0) / okrs.length)
      : 0

    // ── Process decisions ──────────────────────────────────────────────────
    const decisions = decisionsResult.status === 'fulfilled'
      ? decisionsResult.value.data ?? []
      : []
    const openDecs    = decisions.filter((d: Record<string, string>) => d.status === 'open').length
    const pendingDecs = decisions.filter((d: Record<string, string>) => d.status === 'pending_review').length

    // ── Process wellness ───────────────────────────────────────────────────
    const wellnessData = wellnessResult.status === 'fulfilled'
      ? wellnessResult.value.data
      : null
    const todayLogged = wellnessData?.last_activity_date === todayStr

    // ── Process financial ──────────────────────────────────────────────────
    const financial = financialResult.status === 'fulfilled'
      ? financialResult.value.data
      : null

    // ── Process brief ──────────────────────────────────────────────────────
    const brief = briefResult.status === 'fulfilled'
      ? briefResult.value.data
      : null

    // ── Process profile ────────────────────────────────────────────────────
    const profile = profileResult.status === 'fulfilled'
      ? profileResult.value.data
      : null

    // ── Process IP ────────────────────────────────────────────────────────
    const ipAssets = ipResult.status === 'fulfilled'
      ? ipResult.value.data ?? []
      : []
    const expiringSoon = ipAssets.filter((a: Record<string, string>) => {
      if (!a.expiry_date) return false
      const daysToExpiry = (new Date(a.expiry_date).getTime() - today.getTime()) / 86400000
      return daysToExpiry >= 0 && daysToExpiry <= 90
    }).length

    // ── Process credits ────────────────────────────────────────────────────
    const credits = creditsResult.status === 'fulfilled'
      ? creditsResult.value.data
      : null

    return NextResponse.json({
      tasks: {
        total:         tasks.length,
        overdue,
        due_today:     dueToday,
        high_priority: highPriority,
      },
      okrs: {
        total:        okrs.length,
        on_track:     onTrack,
        at_risk:      atRisk,
        avg_progress: avgProgress,
      },
      decisions: {
        total:          decisions.length,
        open:           openDecs,
        pending_review: pendingDecs,
      },
      wellness: wellnessData ? {
        streak:       wellnessData.current_streak ?? 0,
        today_logged: todayLogged,
        last_date:    wellnessData.last_activity_date,
      } : null,
      financial: financial ? {
        revenue:    financial.revenue_gbp,
        burn:       financial.burn_gbp,
        runway:     financial.runway_months,
        period:     financial.period,
      } : null,
      brief: brief ? {
        content:    brief.summary_text,
        brief_date: brief.brief_date,
        exists:     true,
      } : {
        exists: false,
        brief_date: todayStr,
      },
      profile: profile ? {
        full_name:  profile.full_name,
        plan:       profile.plan ?? 'free',
        persona:    profile.persona_type,
        onboarded:  profile.onboarded,
        cv_status:  profile.cv_processing_status,
      } : null,
      ip: {
        total:          ipAssets.length,
        expiring_soon:  expiringSoon,
      },
      credits: credits ? {
        used:  credits.ai_calls_used  ?? 0,
        limit: credits.ai_calls_limit ?? 100,
        pct:   Math.round(((credits.ai_calls_used ?? 0) / (credits.ai_calls_limit ?? 100)) * 100),
      } : { used: 0, limit: 100, pct: 0 },
      generated_at: new Date().toISOString(),
    })
  } catch (err: unknown) {
    console.error('[api/dashboard]', err)
    return NextResponse.json(
      { error: 'Dashboard data failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
