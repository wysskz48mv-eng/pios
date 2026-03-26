/**
 * /api/wellness — Wellness Phase 1 session CRUD + AI insight
 * PIOS v2.9 | VeritasIQ Technologies Ltd
 *
 * GET  — fetch sessions (today / last 30d) + streaks + purpose anchors
 * POST — create session, update streak, trigger AI pattern analysis
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const url  = new URL(req.url)
  const view = url.searchParams.get('view') ?? 'today'
  const today = new Date().toISOString().slice(0, 10)
  const since = view === 'today'
    ? today
    : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const [sessionsRes, streaksRes, anchorsRes, patternsRes] = await Promise.allSettled([
    supabase.from('wellness_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('session_date', since)
      .order('session_date', { ascending: false })
      .order('created_at',  { ascending: false })
      .limit(60),

    supabase.from('wellness_streaks')
      .select('*')
      .eq('user_id', user.id)
      .order('current_streak', { ascending: false }),

    supabase.from('purpose_anchors')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('is_primary', { ascending: false })
      .order('display_order'),

    supabase.from('wellness_patterns')
      .select('*')
      .eq('user_id', user.id)
      .gte('detected_at', new Date(Date.now() - 14 * 86400000).toISOString())
      .order('detected_at', { ascending: false })
      .limit(10),
  ])

  const sessions = sessionsRes.status === 'fulfilled' ? (sessionsRes.value.data ?? []) : []
  const streaks  = streaksRes.status  === 'fulfilled' ? (streaksRes.value.data  ?? []) : []
  const anchors  = anchorsRes.status  === 'fulfilled' ? (anchorsRes.value.data  ?? []) : []
  const patterns = patternsRes.status === 'fulfilled' ? (patternsRes.value.data ?? []) : []

  // Derived stats
  const recentScores = (sessions as Record<string, unknown>[]).slice(0, 7)
  const avgMood   = recentScores.length ? Math.round(recentScores.reduce((s, r) => s + Number(r.mood_score   ?? 5), 0) / recentScores.length * 10) / 10 : null
  const avgEnergy = recentScores.length ? Math.round(recentScores.reduce((s, r) => s + Number(r.energy_score ?? 5), 0) / recentScores.length * 10) / 10 : null
  const avgStress = recentScores.length ? Math.round(recentScores.reduce((s, r) => s + Number(r.stress_score ?? 5), 0) / recentScores.length * 10) / 10 : null
  const todayDone = (sessions as Record<string, unknown>[]).some(s => s.session_date === today)

  return NextResponse.json({
    sessions, streaks, anchors, patterns,
    stats: { avgMood, avgEnergy, avgStress, todayDone, sessionCount: sessions.length },
  }, { headers: { 'Cache-Control': 'no-store' } })
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { action = 'create_session' } = body

  // ── Create session ──────────────────────────────────────────────────────────
  if (action === 'create_session') {
    const {
      session_type, mood_score, energy_score, stress_score, focus_score,
      dominant_domain, notes, tags, duration_mins, gdpr_consent,
    } = body

    if (!gdpr_consent) {
      return NextResponse.json(
        { error: 'GDPR consent required before recording wellness data' },
        { status: 422 }
      )
    }

    // Generate AI insight from session data
    let ai_insight: string | null = null
    let ai_recommended_actions: Record<string, unknown>[] = []

    try {
      const prompt = `You are a wellness coach integrated into PIOS, a personal operating system for busy executives.
      
Analyse this wellness check-in and provide a brief, actionable insight (2–3 sentences max).
Focus on practical adjustments for today, not generic advice.

Check-in data:
- Type: ${session_type}
- Mood: ${mood_score}/10
- Energy: ${energy_score}/10  
- Stress: ${stress_score}/10
- Focus: ${focus_score}/10
- Domain: ${dominant_domain ?? 'general'}
- Notes: ${notes ?? 'none'}

Respond with JSON only:
{
  "insight": "brief personalised observation",
  "actions": [
    {"action": "specific action", "priority": "high|medium|low", "timeframe": "now|today|this_week"}
  ]
}`

      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      })

      const raw = (msg.content[0] as { type: string; text: string }).text.trim()
      const parsed = JSON.parse(raw.replace(/```json|```/g, ''))
      ai_insight = parsed.insight ?? null
      ai_recommended_actions = parsed.actions ?? []
    } catch { /* non-fatal — session saves without AI */ }

    const { data: session, error } = await supabase
      .from('wellness_sessions')
      .insert({
        user_id: user.id,
        session_type, mood_score, energy_score, stress_score, focus_score,
        dominant_domain, notes, tags: tags ?? [],
        duration_mins, gdpr_consent, data_minimised: true,
        ai_insight, ai_recommended_actions,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Update / upsert streak
    const today = new Date().toISOString().slice(0, 10)
    try {
      const { error: rpcErr } = await supabase.rpc('upsert_wellness_streak', {
        p_user_id: user.id,
        p_streak_type: 'daily_checkin',
        p_activity_date: today,
      })
      if (rpcErr) {
        // RPC may not exist yet — upsert manually
        await supabase.from('wellness_streaks')
          .upsert({
            user_id: user.id,
            streak_type: 'daily_checkin',
            last_activity_date: today,
          }, { onConflict: 'user_id,streak_type' })
      }
    } catch {
      // ignore streak errors — non-fatal
    }

    return NextResponse.json({ session, ai_insight, ai_recommended_actions }, { status: 201 })
  }

  // ── Upsert purpose anchor ───────────────────────────────────────────────────
  if (action === 'upsert_anchor') {
    const { anchor_text, anchor_type, domain, is_primary, id } = body

    const payload = { user_id: user.id, anchor_text, anchor_type, domain, is_primary: is_primary ?? false }

    const { data, error } = id
      ? await supabase.from('purpose_anchors').update(payload).eq('id', id).eq('user_id', user.id).select().single()
      : await supabase.from('purpose_anchors').insert(payload).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ anchor: data })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
