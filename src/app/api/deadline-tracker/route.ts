/**
 * GET  /api/deadline-tracker          — all tracked deadlines + countdown
 * POST /api/deadline-tracker          — add custom deadline
 * DELETE /api/deadline-tracker?id=    — remove deadline
 * POST /api/deadline-tracker?action=ai-plan — AI action plan for upcoming deadline
 *
 * Tracks critical deadlines across professional + academic streams.
 * Seeded with known VeritasIQ/DBA deadlines.
 *
 * PIOS™ v3.7.1 | Sprint P — Deadline Tracker | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { callClaude }                from '@/lib/ai/client'

export const dynamic = 'force-dynamic'

// Hardcoded high-priority deadlines (immovable)
const PINNED_DEADLINES = [
  {
    id:          'qiddiya_rfp',
    title:       'Qiddiya RFP Submission',
    subtitle:    'QPMO-410-CT-07922 — Qiddiya City Service Charge Framework',
    due_date:    '2026-04-14',
    due_time:    '17:00 Riyadh (GMT+3)',
    category:    'professional',
    priority:    'critical',
    pinned:      true,
    action_url:  '/platform/rfp',
  },
  {
    id:          'pat_rotation',
    title:       'GitHub PAT Rotation',
    subtitle:    'GitHub PAT expires 16 May 2026 — rotate before 9 May (see Settings → Developer tokens)',
    due_date:    '2026-05-09',
    category:    'technical',
    priority:    'high',
    pinned:      true,
    action_url:  'https://github.com/settings/tokens',
  },
]

function daysUntil(dateStr: string): number {
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400_000))
}

function urgencyColour(days: number, priority: string): string {
  if (priority === 'critical') {
    if (days <= 3)  return '#b91c1c'
    if (days <= 7)  return '#ef4444'
    if (days <= 14) return '#f59e0b'
    return '#C9A84C'
  }
  if (days <= 7)   return '#ef4444'
  if (days <= 14)  return '#f59e0b'
  if (days <= 30)  return '#84cc16'
  return '#22c55e'
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch user-added deadlines
    const { data: userDeadlines } = await supabase
      .from('deadlines')
      .select('id,title,subtitle,due_date,category,priority,action_url,notes')
      .eq('user_id', user.id)
      .gte('due_date', new Date().toISOString().slice(0,10))
      .order('due_date', { ascending: true })
      .limit(20)

    // Merge pinned + user deadlines, compute days remaining
    const all = [
      ...PINNED_DEADLINES.map(d => ({
        ...d, days_left: daysUntil(d.due_date),
        urgency_col: urgencyColour(daysUntil(d.due_date), d.priority),
      })),
      ...(userDeadlines ?? []).map((d: any) => ({
        ...d, pinned: false, days_left: daysUntil(d.due_date),
        urgency_col: urgencyColour(daysUntil(d.due_date), d.priority ?? 'medium'),
      })),
    ].sort((a, b) => a.days_left - b.days_left)

    const overdue    = all.filter(d => d.days_left === 0)
    const critical   = all.filter(d => d.days_left > 0 && d.days_left <= 7)
    const upcoming   = all.filter(d => d.days_left > 7 && d.days_left <= 30)

    return NextResponse.json({
      ok: true,
      deadlines: all,
      summary: { overdue: overdue.length, critical: critical.length, upcoming: upcoming.length },
    })
  } catch (err: any) {
    console.error('[PIOS deadline-tracker GET]', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')
    const body   = await req.json()

    if (action === 'ai-plan') {
      const { deadline } = body
      if (!deadline) return NextResponse.json({ error: 'deadline required' }, { status: 400 })

      const daysLeft = daysUntil(deadline.due_date)
      const plan = await callClaude(
        [{ role: 'user', content:
          `PIOS Chief of Staff. ${daysLeft} days to: "${deadline.title}" (${deadline.subtitle ?? ''}).\n` +
          `Priority: ${deadline.priority ?? 'high'}. Category: ${deadline.category ?? 'professional'}.\n\n` +
          `Write a concrete 5-point action plan for the next ${Math.min(daysLeft, 14)} days.\n` +
          `Format: numbered list, each item ≤15 words. Start with most urgent.`
        }],
        'You are a deadline execution planner. Provide concise, ordered actions with no filler.',
        400,
        'haiku'
      )
      return NextResponse.json({ ok: true, action: 'ai-plan', plan, deadline_title: deadline.title })
    }

    // Add custom deadline
    const { title, subtitle, due_date, category, priority, action_url, notes } = body
    if (!title || !due_date) return NextResponse.json({ error: 'title and due_date required' }, { status: 400 })

    await supabase.from('deadlines').insert({
      user_id: user.id, title, subtitle: subtitle??null, due_date,
      category: category??'professional', priority: priority??'medium',
      action_url: action_url??null, notes: notes??null,
      created_at: new Date().toISOString(),
    })
    return NextResponse.json({ ok: true, title, due_date })
  } catch (err: any) {
    console.error('[PIOS deadline-tracker POST]', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await supabase.from('deadlines').delete().eq('id', id).eq('user_id', user.id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}
