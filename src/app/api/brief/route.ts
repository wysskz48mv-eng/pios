import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/brief         — generate today's brief (or return cached)
 * POST /api/brief?force=1 — force regenerate even if one exists today
 * GET  /api/brief         — return today's cached brief if it exists
 *
 * Called by:
 *   - Dashboard "Generate brief" button
 *   - Morning cron (via /api/cron/morning-brief)
 *
 * Increments ai_calls_used on exec_intelligence_config.
 * VeritasIQ Technologies Ltd · PIOS
 */

export const dynamic     = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const today = new Date().toISOString().split('T')[0]

    const { data: brief } = await supabase
      .from('morning_briefs')
      .select('summary_text,brief_date,created_at,generated_by')
      .eq('user_id', user.id)
      .eq('brief_date', today)
      .single()

    if (!brief) {
      return NextResponse.json({ exists: false, brief_date: today })
    }

    return NextResponse.json({
      exists:     true,
      content:    brief.summary_text,
      brief_date: brief.brief_date,
      cached:     true,
    })
  } catch (err) {
    return NextResponse.json({ exists: false, error: String(err) })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const url   = new URL(req.url)
    const force = url.searchParams.get('force') === '1'
    const today = new Date().toISOString().split('T')[0]

    // Return cached brief if it exists and force not requested
    if (!force) {
      const { data: cached } = await supabase
        .from('morning_briefs')
        .select('summary_text,brief_date')
        .eq('user_id', user.id)
        .eq('brief_date', today)
        .single()

      if (cached?.summary_text) {
        return NextResponse.json({
          content:    cached.summary_text,
          brief_date: today,
          cached:     true,
        })
      }
    }

    // Check AI credit limit
    const { data: credits } = await supabase
      .from('exec_intelligence_config')
      .select('ai_calls_used,ai_calls_limit')
      .eq('user_id', user.id)
      .single()

    if (credits && (credits.ai_calls_used ?? 0) >= (credits.ai_calls_limit ?? 100)) {
      return NextResponse.json({
        error: 'AI credit limit reached for this month',
        used:  credits.ai_calls_used,
        limit: credits.ai_calls_limit,
      }, { status: 429 })
    }

    // Gather context
    const now    = new Date()
    const todayStr = now.toISOString().split('T')[0]

    const [tasksRes, okrsRes, decisionsRes, profileRes, wellnessRes] = await Promise.allSettled([
      supabase.from('tasks').select('title,priority,due_date,status')
        .eq('user_id', user.id).neq('status', 'done').order('priority', { ascending: false }).limit(10),
      supabase.from('okrs').select('title,progress_pct,health')
        .eq('user_id', user.id).limit(6),
      supabase.from('decisions').select('title,status')
        .eq('user_id', user.id).eq('status', 'open').limit(5),
      supabase.from('user_profiles').select('full_name,persona_type')
        .eq('id', user.id).single(),
      supabase.from('wellness_streaks').select('current_streak')
        .eq('user_id', user.id).single(),
    ])

    const tasks     = tasksRes.status     === 'fulfilled' ? (tasksRes.value.data     ?? []) : []
    const okrs      = okrsRes.status      === 'fulfilled' ? (okrsRes.value.data      ?? []) : []
    const decisions = decisionsRes.status === 'fulfilled' ? (decisionsRes.value.data ?? []) : []
    const profile   = profileRes.status   === 'fulfilled' ? profileRes.value.data    : null
    const wellness  = wellnessRes.status  === 'fulfilled' ? wellnessRes.value.data   : null

    const userName = profile?.full_name ?? 'there'
    const dayStr   = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

    const overdue = tasks.filter((t: Record<string, string>) =>
      t.due_date && new Date(t.due_date) < now
    )
    const atRiskOkrs = okrs.filter((o: Record<string, string>) =>
      ['at_risk', 'off_track'].includes(o.health)
    )

    const context = [
      `Date: ${dayStr}`,
      tasks.length > 0
        ? `Open tasks (${tasks.length}): ${tasks.slice(0, 5).map((t: Record<string, string>) => `${t.title} [${t.priority}${overdue.some((o: Record<string, string>) => o.title === t.title) ? ', OVERDUE' : ''}]`).join(', ')}`
        : 'No open tasks',
      okrs.length > 0
        ? `OKRs (${okrs.length}): ${okrs.map((o: Record<string, string>) => `${o.title} ${o.progress_pct}% ${o.health}`).join(' | ')}`
        : 'No active OKRs',
      decisions.length > 0
        ? `Open decisions: ${decisions.map((d: Record<string, string>) => d.title).join(', ')}`
        : 'No open decisions',
      wellness?.current_streak
        ? `Wellness streak: ${wellness.current_streak} days`
        : '',
      atRiskOkrs.length > 0
        ? `AT RISK: ${atRiskOkrs.length} OKRs need attention`
        : '',
    ].filter(Boolean).join('\n')

    const system = `You are NemoClaw™, the personal AI intelligence layer for ${userName}, a founder/CEO/consultant using PIOS.
Write a concise morning brief: 3 focused paragraphs, max 220 words. No bullet points, plain prose.
Para 1: single most important priority today.
Para 2: cross-domain risks or conflicts requiring attention.
Para 3: 2-3 specific actions to take.
Direct, no filler. Address ${userName.split(' ')[0]} directly.`

    // Call Claude
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 500,
        system,
        messages: [{ role: 'user', content: `Generate my morning brief.\n\n${context}` }],
      }),
    })

    const aiData  = await aiRes.json()
    const content = aiData?.content?.[0]?.text ?? 'Brief generation failed — try again.'

    // Upsert brief
    await supabase.from('morning_briefs').upsert({
      user_id:      user.id,
      brief_date:   todayStr,
      summary_text: content,
      generated_by: 'user',
      created_at:   now.toISOString(),
    }, { onConflict: 'user_id,brief_date' })

    // Increment AI usage counter
    await supabase.from('exec_intelligence_config').upsert({
      user_id:       user.id,
      ai_calls_used: (credits?.ai_calls_used ?? 0) + 1,
      updated_at:    now.toISOString(),
    }, { onConflict: 'user_id' })

    return NextResponse.json({
      content,
      brief_date: todayStr,
      cached:     false,
      refreshed:  force,
    })
  } catch (err: unknown) {
    console.error('[api/brief]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Brief generation failed' },
      { status: 500 }
    )
  }
}
