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
    const { data } = await admin.from('commitments').select('*').eq('user_id', user.id).neq('status','done').order('due_date', { ascending: true })
    return NextResponse.json({ commitments: data ?? [] })
  
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
    if (body.action === 'update' && body.id) {
      const { data } = await admin.from('commitments').update({ status: body.status }).eq('id', body.id).eq('user_id', user.id).select().single()
      return NextResponse.json({ commitment: data })
    }
    const { data, error } = await admin.from('commitments').insert({ user_id: user.id, title: body.title, due_date: body.due_date, status: 'open' }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ commitment: data })
  
  } catch (err: any) {
    console.error('[PIOS]', err)
    return apiError(err)
  }
}
