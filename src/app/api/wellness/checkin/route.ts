import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { checkPromptSafety } from '@/lib/security-middleware'

/**
 * POST /api/wellness/checkin
 * Records daily wellness check-in and updates streak.
 * Optionally generates an AI insight via Claude.
 *
 * GET /api/wellness/checkin
 * Returns today's check-in + streak if it exists.
 *
 * VeritasIQ Technologies Ltd · PIOS
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const today = new Date().toISOString().split('T')[0]

    const [sessionRes, streakRes] = await Promise.all([
      supabase.from('wellness_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_date', today)
        .single(),
      supabase.from('wellness_streaks')
        .select('current_streak, longest_streak, last_activity_date')
        .eq('user_id', user.id)
        .single(),
    ])

    return NextResponse.json({
      today:     sessionRes.data ?? null,
      logged:    !!sessionRes.data,
      streak:    streakRes.data ?? { current_streak: 0, longest_streak: 0 },
      date:      today,
    })
  } catch (err) {
    return NextResponse.json({ logged: false, streak: null, error: String(err) })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const body = await req.json()
  // Prompt injection defence — IS-POL-008
  const _userText = Object.values(body ?? {}).filter(v => typeof v === 'string').join(' ')
  const _safety = checkPromptSafety(_userText)
  if (!_safety.safe) return NextResponse.json({ error: 'Input rejected: ' + _safety.reason }, { status: 400 })

    const {
      mood_score,
      energy_score,
      stress_score,
      focus_score,
      notes,
      generate_insight = false,
    } = body as {
      mood_score:       number
      energy_score?:    number
      stress_score?:    number
      focus_score?:     number
      notes?:           string
      generate_insight?: boolean
    }

    if (!mood_score || mood_score < 1 || mood_score > 10) {
      return NextResponse.json({ error: 'mood_score 1–10 required' }, { status: 400 })
    }

    const today = new Date().toISOString().split('T')[0]
    let ai_insight: string | null = null

    // Generate AI insight if requested and ANTHROPIC_API_KEY available
    if (generate_insight && process.env.ANTHROPIC_API_KEY) {
      const scores = [
        `Mood: ${mood_score}/10`,
        energy_score ? `Energy: ${energy_score}/10` : null,
        stress_score ? `Stress: ${stress_score}/10` : null,
        focus_score  ? `Focus: ${focus_score}/10`  : null,
        notes ? `Notes: "${notes}"` : null,
      ].filter(Boolean).join(', ')

      try {
        ai_insight = await callClaude(
          [{ role: 'user', content: `Today's wellness check-in: ${scores}. Brief insight:` }],
          `You are a wellness coach for a busy founder/CEO. Give a single, direct 2-sentence observation based on today's check-in scores. Be specific and actionable. No filler phrases.`,
          150
        ) || null
      } catch {
        // Non-fatal — insight is optional
      }
    }

    // Upsert today's session (one per day)
    const { data: session, error: sessionErr } = await supabase
      .from('wellness_sessions')
      .upsert({
        user_id:      user.id,
        session_date: today,
        mood_score,
        energy_score:  energy_score ?? null,
        stress_score:  stress_score ?? null,
        focus_score:   focus_score  ?? null,
        notes:         notes ?? null,
        ai_insight,
        created_at:    new Date().toISOString(),
      }, { onConflict: 'user_id,session_date' })
      .select()
      .single()

    if (sessionErr) {
      return NextResponse.json({ error: sessionErr.message }, { status: 400 })
    }

    // Update streak
    const { data: streak } = await supabase
      .from('wellness_streaks')
      .select('current_streak, longest_streak, last_activity_date')
      .eq('user_id', user.id)
      .single()

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const wasYesterday = streak?.last_activity_date === yesterdayStr
    const isToday      = streak?.last_activity_date === today

    let newStreak = 1
    if (isToday) {
      newStreak = streak?.current_streak ?? 1  // Already logged today
    } else if (wasYesterday) {
      newStreak = (streak?.current_streak ?? 0) + 1
    }

    const newLongest = Math.max(newStreak, streak?.longest_streak ?? 0)

    await supabase.from('wellness_streaks').upsert({
      user_id:            user.id,
      current_streak:     newStreak,
      longest_streak:     newLongest,
      last_activity_date: today,
      updated_at:         new Date().toISOString(),
    }, { onConflict: 'user_id' })

    return NextResponse.json({
      ok:        true,
      session,
      ai_insight,
      streak: {
        current_streak:  newStreak,
        longest_streak:  newLongest,
        last_activity_date: today,
      },
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Check-in failed' },
      { status: 500 }
    )
  }
}
