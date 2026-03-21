import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data } = await supabase.from('projects').select('*')
      .eq('user_id', user.id).neq('status', 'cancelled').order('created_at', { ascending: false })
    return NextResponse.json({ projects: data ?? [] })
  } catch (err: any) {
    console.error('/projects:', err)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const { data, error } = await supabase.from('projects').insert({ ...body, user_id: user.id }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ project: data })
  } catch (err: any) {
    console.error('/projects:', err)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, ...updates } = await request.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const { data, error } = await supabase.from('projects').update(updates).eq('id', id).eq('user_id', user.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ project: data })
  } catch (err: any) {
    console.error('/projects:', err)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
