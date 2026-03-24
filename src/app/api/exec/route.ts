/**
 * /api/exec — Executive persona aggregated data endpoint
 * Feeds EOSA™ dashboard: principles, decisions, reviews, OKRs, stakeholders
 * PIOS Sprint 22 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const section = searchParams.get('section') ?? 'all'

    const [
      principlesR, decisionsR, reviewsR,
      okrsR, stakeholdersR, timeBlocksR
    ] = await Promise.all([
      section === 'all' || section === 'principles'
        ? supabase.from('exec_principles').select('*').eq('user_id', user.id).order('sort_order')
        : Promise.resolve({ data: null }),
      section === 'all' || section === 'decisions'
        ? supabase.from('exec_decisions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
        : Promise.resolve({ data: null }),
      section === 'all' || section === 'reviews'
        ? supabase.from('exec_reviews').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
        : Promise.resolve({ data: null }),
      section === 'all' || section === 'okrs'
        ? supabase.from('exec_okrs').select('*, exec_key_results(*)').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: false })
        : Promise.resolve({ data: null }),
      section === 'all' || section === 'stakeholders'
        ? supabase.from('exec_stakeholders').select('*').eq('user_id', user.id).order('importance').limit(30)
        : Promise.resolve({ data: null }),
      section === 'all' || section === 'time'
        ? supabase.from('exec_time_blocks').select('*').eq('user_id', user.id).order('start_time')
        : Promise.resolve({ data: null }),
    ])

    // OKR health summary
    const okrs = (okrsR.data ?? []) as Record<string, unknown>[]
    const okrSummary = {
      total: okrs.length,
      on_track: okrs.filter(o => o.health === 'on_track').length,
      at_risk: okrs.filter(o => o.health === 'at_risk').length,
      off_track: okrs.filter(o => o.health === 'off_track').length,
      avg_progress: okrs.length
        ? Math.round(okrs.reduce((s, o) => s + ((o.progress as number) ?? 0), 0) / okrs.length)
        : 0,
    }

    // Stakeholder health
    const stakeholders = (stakeholdersR.data ?? []) as Record<string, unknown>[]
    const stakeHealth = {
      critical_count: stakeholders.filter(s => s.importance === 'critical').length,
      needs_touchpoint: stakeholders.filter(s =>
        s.next_touchpoint && new Date(s.next_touchpoint as string) <= new Date()
      ).length,
    }

    return NextResponse.json({
      principles:   principlesR.data ?? [],
      decisions:    decisionsR.data ?? [],
      reviews:      reviewsR.data ?? [],
      okrs:         okrsR.data ?? [],
      stakeholders: stakeholdersR.data ?? [],
      time_blocks:  timeBlocksR.data ?? [],
      summary: { okrs: okrSummary, stakeholders: stakeHealth },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const body = await req.json()
    const { table, payload } = body as { table: string; payload: Record<string, unknown> }

    const ALLOWED = ['exec_principles','exec_decisions','exec_reviews',
                     'exec_stakeholders','exec_okrs','exec_key_results','exec_time_blocks']
    if (!ALLOWED.includes(table)) return NextResponse.json({ error: 'Invalid table' }, { status: 400 })

    const { data, error } = await supabase
      .from(table as Parameters<typeof supabase.from>[0])
      .insert({ ...payload, user_id: user.id, tenant_id: profile.tenant_id })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ data }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { table, id, payload } = body as { table: string; id: string; payload: Record<string, unknown> }

    const ALLOWED = ['exec_principles','exec_decisions','exec_reviews',
                     'exec_stakeholders','exec_okrs','exec_key_results','exec_time_blocks']
    if (!ALLOWED.includes(table)) return NextResponse.json({ error: 'Invalid table' }, { status: 400 })

    const { data, error } = await supabase
      .from(table as Parameters<typeof supabase.from>[0])
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', user.id)
      .select().single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
