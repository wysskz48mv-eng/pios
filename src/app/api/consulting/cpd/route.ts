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
    const { data, error } = await admin
      .from('cpd_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(100)
    if (error) throw new Error(error.message)

    return NextResponse.json({ entries: data ?? [] })
  } catch (e: any) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const body = await req.json()
    const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data, error } = await admin
      .from('cpd_entries')
      .insert({ user_id: user.id, ...body })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message || 'Validation failed' }, { status: 400 })

    return NextResponse.json({ entry: data }, { status: 201 })
  } catch (e: any) {
    return apiError(e)
  }
}
