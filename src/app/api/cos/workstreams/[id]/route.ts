import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {  
    const { id } = await params
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    const body = await req.json()
    const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data, error } = await admin.from('portfolio_workstreams').update(body).eq('id', id).eq('user_id', user.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ workstream: data })
  
  } catch (err: any) {
    console.error('[PIOS]', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {  
    const { id } = await params
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    await admin.from('portfolio_workstreams').delete().eq('id', id).eq('user_id', user.id)
    return NextResponse.json({ ok: true })
  
  } catch (err: any) {
    console.error('[PIOS]', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}
