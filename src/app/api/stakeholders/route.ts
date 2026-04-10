import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET  /api/stakeholders — list stakeholders for current user
 * POST /api/stakeholders — create stakeholder
 * PATCH /api/stakeholders?id=xxx — update stakeholder
 * DELETE /api/stakeholders?id=xxx — delete stakeholder
 * VeritasIQ Technologies Ltd
 */

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { data, error } = await supabase
      .from('stakeholders')
      .select('*')
      .eq('user_id', user.id)
      .order('influence', { ascending: false })

    if (error) return NextResponse.json({ stakeholders: [] })
    return NextResponse.json({ stakeholders: data ?? [] })
  } catch {
    return NextResponse.json({ stakeholders: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const body = await req.json()
    const { name, role, organisation, influence, alignment, engagement, notes, tags } = body

    if (!name || !role) {
      return NextResponse.json({ error: 'name and role required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('stakeholders')
      .insert({
        user_id:      user.id,
        name,
        role,
        organisation: organisation ?? null,
        influence:    influence ?? 3,
        alignment:    alignment ?? 3,
        engagement:   engagement ?? 'medium',
        notes:        notes ?? null,
        tags:         tags ?? [],
        created_at:   new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
    return NextResponse.json({ stakeholder: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const url = new URL(req.url)
    const id  = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await req.json()
    const { data, error } = await supabase
      .from('stakeholders')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
    return NextResponse.json({ stakeholder: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const url = new URL(req.url)
    const id  = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { error } = await supabase.from('stakeholders').delete().eq('id', id).eq('user_id', user.id)
    if (error) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
