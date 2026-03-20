import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)

  const [tasksRes, modulesRes, eventsRes, projectsRes] = await Promise.all([
    supabase.from('tasks').select('title,domain,priority,due_date,status').eq('user_id', user.id).neq('status', 'done').order('due_date', { ascending: true }).limit(10),
    supabase.from('academic_modules').select('title,status,deadline').eq('user_id', user.id).in('status', ['in_progress', 'upcoming']).limit(5),
    supabase.from('calendar_events').select('title,start_time,domain').eq('user_id', user.id).gte('start_time', `${today}T00:00:00`).lte('start_time', `${today}T23:59:59`).limit(8),
    supabase.from('projects').select('title,domain,status,progress').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: false }).limit(6),
  ])

  const ctx = `Today: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

Open tasks (${tasksRes.data?.length ?? 0}): ${JSON.stringify(tasksRes.data?.slice(0, 8))}
Academic modules in progress: ${JSON.stringify(modulesRes.data)}
Active projects: ${JSON.stringify(projectsRes.data)}
Today's calendar events: ${JSON.stringify(eventsRes.data)}`

  const system = `You are PIOS AI generating Douglas Masuku's daily morning brief. Douglas is a DBA candidate at the University of Portsmouth, FM consultant, SaaS founder (SustainEdge, InvestiScript, PIOS), and Group CEO of Sustain International FZE Ltd. Be concise, direct, and action-oriented. Identify the single most important focus, flag cross-domain conflicts, surface anything urgent or at risk. Format: 3-4 tight paragraphs, no headers, no bullet points. Plain prose, 200-280 words maximum.`

  try {
    const content = await callClaude(
      [{ role: 'user', content: `Generate my morning brief.\n\n${ctx}` }],
      system,
      600
    )

    await supabase.from('daily_briefs').upsert({
      user_id: user.id,
      brief_date: today,
      content,
      ai_model: 'claude-sonnet-4-20250514',
    }, { onConflict: 'user_id,brief_date' })

    return NextResponse.json({ content })
  } catch (err) {
    console.error('Brief generation error:', err)
    return NextResponse.json({ error: 'Brief generation failed' }, { status: 500 })
  }
}
