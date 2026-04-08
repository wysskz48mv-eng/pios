import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabasePublicKey, getSupabaseUrl } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublicKey(),
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() { /* read-only in GET */ },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: summary, error } = await supabase
    .from('weekly_summaries')
    .select('*')
    .eq('user_id', user.id)
    .order('week_end', { ascending: false })
    .limit(1)
    .single()

  if (error || !summary) {
    return NextResponse.json({ error: 'No summary found' }, { status: 404 })
  }

  return NextResponse.json(summary)
}
