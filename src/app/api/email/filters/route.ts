/**
 * GET  /api/email/filters           — list all filters
 * POST /api/email/filters           — create filter
 * PUT  /api/email/filters?id=       — update filter
 * DELETE /api/email/filters?id=     — delete filter
 *
 * PIOS v3.7.2 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase
      .from('email_filters')
      .select('*')
      .eq('user_id', user.id)
      .order('priority')

    return NextResponse.json({ filters: data ?? [] })
  } catch (err) { return apiError(err) }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, match_field, match_mode, match_value, action, action_value, priority } = body

    if (!match_field || !match_value || !action) {
      return NextResponse.json({ error: 'match_field, match_value, and action required' }, { status: 400 })
    }

    const { data, error } = await supabase.from('email_filters').insert({
      user_id: user.id,
      name: name ?? `${match_field} ${match_mode ?? 'contains'} "${match_value}" → ${action}`,
      match_field,
      match_mode: match_mode ?? 'contains',
      match_value,
      action,
      action_value: action_value ?? null,
      priority: priority ?? 100,
    }).select().single()

    if (error) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
    return NextResponse.json({ filter: data }, { status: 201 })
  } catch (err) { return apiError(err) }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await req.json()
    const { data, error } = await supabase
      .from('email_filters')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
    return NextResponse.json({ filter: data })
  } catch (err) { return apiError(err) }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await supabase.from('email_filters').delete().eq('id', id).eq('user_id', user.id)
    return NextResponse.json({ deleted: true })
  } catch (err) { return apiError(err) }
}
