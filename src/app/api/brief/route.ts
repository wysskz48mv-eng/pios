import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect('/auth/login')

  const today = new Date().toISOString().slice(0, 10)

  // Gather cross-domain context
  const [tasksRes, modulesRes, eventsRes, emailsRes] = await Promise.all([
    supabase.from('tasks').select('title,domain,priority,due_date,status').eq('user_id',user.id).neq('status','done').order('due_date',{ascending:true}).limit(10),
    supabase.from('academic_modules').select('title,status,deadline').eq('user_id',user.id).in('status',['in_progress','upcoming']).limit(5),
    supabase.from('calendar_events').select('title,start_time,domain').eq('user_id',user.id).gte('start_time',`${today}T00:00:00`).lte('start_time',`${today}T23:59:59`).limit(8),
    supabase.from('email_items').select('subject,sender_name,priority_score,action_required').eq('user_id',user.id).eq('status','triaged').order('priority_score',{ascending:false}).limit(5),
  ])

  const ctx = `
Today: ${new Date().toLocaleDateString('en-GB', {weekday:'long',day:'numeric',month:'long',year:'numeric'})}

Open tasks (${tasksRes.data?.length}): ${JSON.stringify(tasksRes.data?.slice(0,6))}
Academic modules: ${JSON.stringify(modulesRes.data)}
Today's calendar: ${JSON.stringify(eventsRes.data)}
Priority emails: ${JSON.stringify(emailsRes.data)}
`

  const system = `You are PIOS AI generating Douglas Masuku's daily morning brief. Be concise, direct, and action-oriented. Douglas is a DBA candidate, FM consultant, SaaS founder, and Group CEO. Identify cross-domain conflicts, surface the single most important focus, and flag anything urgent. Format: 3-4 tight paragraphs, no headers, no bullet points. Plain prose, maximum 300 words.`

  try {
    const content = await callClaude([{ role:'user', content:`Generate my morning brief for today.\n\n${ctx}` }], system, 600)
    await supabase.from('daily_briefs').upsert({
      user_id: user.id, brief_date: today, content,
      ai_model: 'claude-sonnet-4-20250514',
    }, { onConflict: 'user_id,brief_date' })
    return NextResponse.redirect('/platform/dashboard')
  } catch {
    return NextResponse.redirect('/platform/dashboard?error=brief_failed')
  }
}
