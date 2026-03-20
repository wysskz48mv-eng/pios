import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { callClaude } from '@/lib/ai/client'

export async function POST(request: Request) {
  // Create supabase with cookies from request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookieHeader = request.headers.get('cookie') || ''
          return cookieHeader.split(';').map(c => {
            const [name, ...rest] = c.trim().split('=')
            return { name: name.trim(), value: rest.join('=') }
          }).filter(c => c.name)
        },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)

  const [tasksRes, modulesRes, projectsRes, notifRes] = await Promise.all([
    supabase.from('tasks').select('title,domain,priority,due_date,status')
      .eq('user_id', user.id).neq('status', 'done').order('due_date', { ascending: true }).limit(10),
    supabase.from('academic_modules').select('title,status,deadline')
      .eq('user_id', user.id).in('status', ['in_progress', 'upcoming']).limit(5),
    supabase.from('projects').select('title,domain,status,progress')
      .eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: false }).limit(6),
    supabase.from('notifications').select('title,type,domain')
      .eq('user_id', user.id).eq('read', false).order('created_at', { ascending: false }).limit(5),
  ])

  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const ctx = `Today: ${dateStr}

Open tasks (${tasksRes.data?.length || 0}):
${tasksRes.data?.map(t => `- [${t.priority.toUpperCase()}] ${t.title} (${t.domain}) — ${t.due_date ? new Date(t.due_date).toLocaleDateString('en-GB') : 'no date'}`).join('\n') || 'None'}

Active academic modules:
${modulesRes.data?.map(m => `- ${m.title}: ${m.status} — deadline ${m.deadline || 'TBC'}`).join('\n') || 'None'}

Active projects:
${projectsRes.data?.map(p => `- ${p.title} (${p.domain}) — ${p.progress}% complete`).join('\n') || 'None'}

Unread notifications:
${notifRes.data?.map(n => `- [${n.type.toUpperCase()}] ${n.title}`).join('\n') || 'None'}`

  const system = `You are PIOS AI generating Douglas Masuku's daily morning brief. Douglas is simultaneously: a DBA candidate at University of Portsmouth, Group CEO of Sustain International FZE Ltd, FM consultant pursuing the Qiddiya QPMO-410-CT-07922 RFP, and builder of three SaaS products (SustainEdge, InvestiScript, PIOS).

Write a morning brief that is: direct, practical, cross-domain aware. 3–4 tight paragraphs of plain prose. No headers. No bullet points. Surface the single most important focus, note any cross-domain conflicts or risks, and flag what needs immediate action today. Maximum 280 words.`

  try {
    const content = await callClaude(
      [{ role: 'user', content: `Generate my morning brief for today.\n\n${ctx}` }],
      system,
      650
    )

    // Upsert the brief into Supabase
    await supabase.from('daily_briefs').upsert({
      user_id: user.id,
      brief_date: today,
      content,
      ai_model: 'claude-sonnet-4-20250514',
    }, { onConflict: 'user_id,brief_date' })

    return NextResponse.json({ content, brief_date: today })
  } catch (err) {
    console.error('Brief generation error:', err)
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
  }
}
