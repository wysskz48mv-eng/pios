import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ publications: [] })

    const { data } = await supabase
      .from('publications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    return NextResponse.json({ publications: data ?? [] })
  } catch {
    return NextResponse.json({ publications: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const body   = await req.json()
    const { title, type, status, venue, authors, year, doi, url, notes } = body

    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

    const { data, error } = await supabase
      .from('publications')
      .insert({
        user_id:    user.id,
        title,
        type:       type ?? 'journal',
        status:     status ?? 'draft',
        venue:      venue ?? null,
        authors:    authors ?? null,
        year:       year ?? new Date().getFullYear(),
        doi:        doi ?? null,
        url:        url ?? null,
        notes:      notes ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ publication: data }, { status: 201 })
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
      .from('publications')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', user.id)
      .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ publication: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
