/**
 * /api/planning — Strategic Planning CRUD
 * Handles visions, domains, goals, habits, sprints, cycles, reflections
 * PIOS v3.7.2 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const TABLES: Record<string, string> = {
  visions: 'strategic_visions',
  domains: 'user_life_domains',
  goals: 'strategic_goals',
  habits: 'user_habits',
  sprints: 'learning_sprints',
  cycles: 'quarterly_cycles',
  reflections: 'reflections',
  values: 'user_values',
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const type = req.nextUrl.searchParams.get('type') ?? 'visions'
    const table = TABLES[type]
    if (!table) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

    const { data } = await supabase.from(table).select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    return NextResponse.json({ [type]: data ?? [] })
  } catch { return NextResponse.json({ error: 'Internal error' }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action, type, id, ...fields } = body
    const table = TABLES[type]
    if (!table) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

    if (action === 'create') {
      const { data, error } = await supabase.from(table).insert({ user_id: user.id, ...fields }).select().single()
      if (error) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
      return NextResponse.json({ data }, { status: 201 })
    }

    if (action === 'update') {
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const { data, error } = await supabase.from(table).update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id).select().single()
      if (error) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
      return NextResponse.json({ data })
    }

    if (action === 'upsert' && type === 'visions') {
      const { data, error } = await supabase.from(table).upsert({ user_id: user.id, ...fields }, { onConflict: 'user_id,horizon' }).select().single()
      if (error) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
      return NextResponse.json({ data })
    }

    if (action === 'delete') {
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      await supabase.from(table).delete().eq('id', id).eq('user_id', user.id)
      return NextResponse.json({ deleted: true })
    }

    if (action === 'log_habit') {
      const { data, error } = await supabase.from('habit_logs').upsert({
        habit_id: id, log_date: fields.log_date ?? new Date().toISOString().slice(0, 10),
        completed: fields.completed ?? true, notes: fields.notes ?? null,
      }, { onConflict: 'habit_id,log_date' }).select().single()

      // Update streak
      if (!error && fields.completed !== false) {
        const { data: habit } = await supabase.from('user_habits').select('current_streak, best_streak').eq('id', id).single()
        const newStreak = (habit?.current_streak ?? 0) + 1
        await supabase.from('user_habits').update({
          current_streak: newStreak,
          best_streak: Math.max(newStreak, habit?.best_streak ?? 0),
        }).eq('id', id)
      }

      return NextResponse.json({ data })
    }

    if (action === 'dashboard') {
      const today = new Date().toISOString().slice(0, 10)
      const [visionsR, domainsR, goalsR, habitsR, sprintsR, cyclesR] = await Promise.allSettled([
        supabase.from('strategic_visions').select('horizon, title, description').eq('user_id', user.id),
        supabase.from('user_life_domains').select('*').eq('user_id', user.id).order('sort_order'),
        supabase.from('strategic_goals').select('*').eq('user_id', user.id).eq('status', 'active'),
        supabase.from('user_habits').select('*, habit_logs(log_date, completed)').eq('user_id', user.id),
        supabase.from('learning_sprints').select('*').eq('user_id', user.id).in('status', ['planned', 'running']),
        supabase.from('quarterly_cycles').select('*').eq('user_id', user.id).eq('status', 'active').limit(1),
      ])

      const s = (r: any) => r.status === 'fulfilled' ? (r.value?.data ?? []) : []

      return NextResponse.json({
        visions: s(visionsR),
        domains: s(domainsR),
        goals: s(goalsR),
        habits: s(habitsR),
        sprints: s(sprintsR),
        cycle: s(cyclesR)[0] ?? null,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch { return NextResponse.json({ error: 'Internal error' }, { status: 500 }) }
}
