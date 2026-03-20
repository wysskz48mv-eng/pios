import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [mods, chaps, sessions] = await Promise.all([
    supabase.from('academic_modules').select('*').eq('user_id', user.id).order('sort_order'),
    supabase.from('thesis_chapters').select('*').eq('user_id', user.id).order('chapter_num'),
    supabase.from('supervision_sessions').select('*').eq('user_id', user.id).order('session_date', { ascending: false }).limit(10),
  ])
  return NextResponse.json({ modules: mods.data ?? [], chapters: chaps.data ?? [], sessions: sessions.data ?? [] })
}
