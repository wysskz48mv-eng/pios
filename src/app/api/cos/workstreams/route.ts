import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {  
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data } = await admin.from('portfolio_workstreams').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    return NextResponse.json({ workstreams: data ?? [] })
  
  } catch (err: any) {
    console.error('[PIOS]', err)
    return apiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {  
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    const body = await req.json()
    const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    if (body.id) {
      const { data } = await admin.from('portfolio_workstreams').update({ status: body.status, name: body.name }).eq('id', body.id).eq('user_id', user.id).select().single()
      return NextResponse.json({ workstream: data })
    }
    const { data, error } = await admin.from('portfolio_workstreams').insert({ user_id: user.id, name: body.name, status: body.status ?? 'active' }).select().single()
    if (error) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
    return NextResponse.json({ workstream: data })
  
  } catch (err: any) {
    console.error('[PIOS]', err)
    return apiError(err)
  }
}
