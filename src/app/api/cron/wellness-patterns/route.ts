import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callClaude } from '@/lib/ai/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  // Find users with 7+ check-ins in last 30 days
  const { data: activeUsers } = await supabase
    .from('wellness_sessions')
    .select('user_id')
    .gte('session_date', thirtyDaysAgo.split('T')[0])
    .order('user_id')

  if (!activeUsers?.length) {
    return NextResponse.json({ ok: true, processed: 0, message: 'No active wellness users' })
  }

  // Group by user and filter 7+
  const userCounts = new Map<string, number>()
  for (const row of activeUsers) {
    userCounts.set(row.user_id, (userCounts.get(row.user_id) ?? 0) + 1)
  }
  const qualifiedUsers = Array.from(userCounts.entries()).filter(([, count]) => count >= 7).map(([id]) => id)

  let processed = 0
  let alerts = 0

  for (const userId of qualifiedUsers) {
    // Get last 30 days of sessions
    const { data: sessions } = await supabase
      .from('wellness_sessions')
      .select('session_date,mood_score,energy_score,stress_score,focus_score')
      .eq('user_id', userId)
      .gte('session_date', thirtyDaysAgo.split('T')[0])
      .order('session_date', { ascending: true })

    if (!sessions?.length) continue

    // Calculate averages
    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length
    const moods = sessions.map(s => s.mood_score).filter(Boolean) as number[]
    const energies = sessions.map(s => s.energy_score).filter(Boolean) as number[]
    const stresses = sessions.map(s => s.stress_score).filter(Boolean) as number[]
    const focuses = sessions.map(s => s.focus_score).filter(Boolean) as number[]

    const avgMood = moods.length ? avg(moods) : null
    const avgEnergy = energies.length ? avg(energies) : null
    const avgStress = stresses.length ? avg(stresses) : null
    const avgFocus = focuses.length ? avg(focuses) : null

    // Trend detection on last 7 sessions (simple linear regression slope)
    const recent = sessions.slice(-7)
    const trendSlope = (vals: number[]) => {
      if (vals.length < 3) return 0
      const n = vals.length
      const xMean = (n - 1) / 2
      const yMean = avg(vals)
      let num = 0, den = 0
      for (let i = 0; i < n; i++) {
        num += (i - xMean) * (vals[i] - yMean)
        den += (i - xMean) ** 2
      }
      return den === 0 ? 0 : num / den
    }

    const moodTrend = trendSlope(recent.map(s => s.mood_score ?? 5))
    const energyTrend = trendSlope(recent.map(s => s.energy_score ?? 5))
    const trendDirection = (moodTrend + energyTrend) / 2 > 0.15 ? 'improving'
      : (moodTrend + energyTrend) / 2 < -0.15 ? 'declining' : 'stable'

    // Alert detection: any dimension below 4 for 5+ consecutive days
    let alertTriggered = false
    for (const dim of ['mood_score', 'energy_score', 'stress_score', 'focus_score'] as const) {
      // For stress, HIGH stress (>7) is the alert, not low
      const threshold = dim === 'stress_score' ? 7 : 4
      const isAlert = dim === 'stress_score'
        ? (v: number) => v > threshold
        : (v: number) => v < threshold
      let consecutive = 0
      for (const s of sessions.slice(-10)) {
        const val = s[dim]
        if (val != null && isAlert(val)) { consecutive++ } else { consecutive = 0 }
        if (consecutive >= 5) { alertTriggered = true; break }
      }
      if (alertTriggered) break
    }

    // AI-generated pattern summary
    let patternSummary = ''
    try {
      patternSummary = await callClaude(
        [{ role: 'user', content: `Wellness data for the past ${sessions.length} days:\nAvg mood: ${avgMood?.toFixed(1)}, energy: ${avgEnergy?.toFixed(1)}, stress: ${avgStress?.toFixed(1)}, focus: ${avgFocus?.toFixed(1)}\nTrend: ${trendDirection} (mood slope: ${moodTrend.toFixed(2)}, energy slope: ${energyTrend.toFixed(2)})\nAlert: ${alertTriggered ? 'YES — sustained low scores detected' : 'No'}\n\nWrite exactly 2 sentences: (1) the pattern you see, (2) one specific actionable suggestion. Be direct.` }],
        'You are a wellness pattern analyst. Be concise.',
        150,
        'haiku'
      )
    } catch {
      patternSummary = trendDirection === 'declining'
        ? 'Scores are trending downward over the past week. Consider reviewing your workload and scheduling recovery time.'
        : 'Wellness scores are stable. Continue your current routines.'
    }

    // Write pattern to wellness_patterns
    const periodStart = sessions[0].session_date
    const periodEnd = sessions[sessions.length - 1].session_date

    await supabase.from('wellness_patterns').insert({
      user_id: userId,
      pattern_type: alertTriggered ? 'stress_trigger' : trendDirection === 'improving' ? 'recovery_signal' : trendDirection === 'declining' ? 'mood_trend' : 'energy_cycle',
      pattern_label: `${trendDirection} · ${periodStart} to ${periodEnd}`,
      pattern_data: {
        avg_mood: avgMood, avg_energy: avgEnergy, avg_stress: avgStress, avg_focus: avgFocus,
        trend_direction: trendDirection, mood_slope: moodTrend, energy_slope: energyTrend,
        session_count: sessions.length, alert_triggered: alertTriggered,
      },
      confidence: Math.min(0.95, sessions.length / 30),
      detected_at: new Date().toISOString(),
      valid_until: new Date(Date.now() + 7 * 86400000).toISOString(),
      acted_on: false,
    })

    // If alert triggered, create a task
    if (alertTriggered) {
      await supabase.from('tasks').insert({
        user_id: userId,
        title: 'Wellness check: sustained low scores detected this week',
        description: patternSummary,
        priority: 'high',
        status: 'todo',
        domain: 'personal',
        source: 'wellness_cron',
        due_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      alerts++
    }

    processed++
  }

  return NextResponse.json({ ok: true, processed, alerts, qualified: qualifiedUsers.length })
}
