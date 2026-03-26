/**
 * GET  /api/milestones             — list user's programme milestones
 * POST /api/milestones             — create milestone
 * PATCH /api/milestones            — update milestone (status, dates, notes)
 * DELETE /api/milestones?id=       — delete milestone
 *
 * PIOS v3.0 | Sprint 22 | VeritasIQ Technologies Ltd
 * Table: programme_milestones (M011 — supersedes dba_milestones M010)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MILESTONE_TYPES = [
  'registration','ethics_approval','literature_review','research_proposal',
  'upgrade','data_collection','analysis','thesis_submission','viva',
  'corrections','award','other','checkpoint',
]

const STATUSES = ['upcoming','in_progress','submitted','passed','failed','deferred','waived','skipped']

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const status   = searchParams.get('status')
    const upcoming = searchParams.get('upcoming') === '1'

    let q = supabase
      .from('programme_milestones')
      .select('*')
      .eq('user_id', user.id)
      .order('target_date', { ascending: true, nullsFirst: false })
      .order('sort_order')
      .limit(100)

    if (category) q = q.eq('category', category)
    if (status)   q = q.eq('status', status)
    if (upcoming) q = q.in('status', ['upcoming', 'in_progress'])

    const { data, error } = await q
    if (error) return NextResponse.json({ error: (error as Error).message }, { status: 500 })

    // Compute days_until for each milestone
    const now = new Date()
    const enriched = (data ?? []).map((m: Record<string, unknown>) => ({
      ...m,
      days_until:  (m as any)?.target_date
        ? Math.ceil((new Date(String((m as any)?.target_date ?? "")).getTime() - now.getTime()) / 86400000)
        : null,
      is_overdue: (m as any)?.target_date && new Date(String((m as any)?.target_date ?? "")) < now
        && !['passed','waived','skipped'].includes((m as any)?.status),
    }))

    // Summary counts
    const summary = {
      total:       enriched.length,
      upcoming:    enriched.filter((m: any) => (m as Record<string,unknown>).status === 'upcoming').length,
      in_progress: enriched.filter((m: any) => (m as Record<string,unknown>).status === 'in_progress').length,
      completed:   enriched.filter(m => ['passed','submitted'].includes((m as any)?.status)).length,
      overdue:     enriched.filter((m: any) => (m as Record<string,unknown>).is_overdue).length,
      next:        enriched.find(m => (m as any)?.status === 'upcoming' && (m as any)?.target_date) ?? null,
    }

    return NextResponse.json({ ok: true, milestones: enriched, summary })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      title, milestone_type = 'checkpoint', category = 'academic',
      target_date, notes, alert_days_before = 14,
      cpd_type, cpd_body, hours_credit, sort_order,
    } = body

    if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

    const { data, error } = await supabase
      .from('programme_milestones')
      .insert({
        user_id: user.id,
        title: title.trim(),
        milestone_type,
        category,
        status: 'upcoming',
        target_date:        target_date        ?? null,
        notes:              notes              ?? null,
        alert_days_before:  alert_days_before,
        cpd_type:           cpd_type           ?? null,
        cpd_body:           cpd_body           ?? null,
        hours_credit:       hours_credit       ?? 0,
        sort_order:         sort_order         ?? 0,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: (error as Error).message }, { status: 500 })
    return NextResponse.json({ ok: true, milestone: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // Validate status if provided
    if (updates.status && !STATUSES.includes(updates.status)) {
      return NextResponse.json({ error: `Invalid status. Valid: ${STATUSES.join(', ')}` }, { status: 400 })
    }

    // Set completed_date automatically when passing
    if (updates.status === 'passed' && !updates.completed_date) {
      updates.completed_date = new Date().toISOString().slice(0, 10)
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('programme_milestones')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: (error as Error).message }, { status: 500 })
    return NextResponse.json({ ok: true, milestone: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { error } = await supabase
      .from('programme_milestones')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: (error as Error).message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
