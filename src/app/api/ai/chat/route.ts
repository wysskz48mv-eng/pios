import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messages, domainContext } = await request.json()
    if (!messages?.length) return NextResponse.json({ error: 'No messages' }, { status: 400 })

    // Build rich live context for the AI
    const [tasksR, modulesR, projectsR, chaptersR, notifsR] = await Promise.all([
      supabase.from('tasks').select('title,domain,priority,due_date,status')
        .eq('user_id', user.id).not('status', 'in', '("done","cancelled")')
        .order('due_date', { ascending: true }).limit(8),
      supabase.from('academic_modules').select('title,status,deadline')
        .eq('user_id', user.id).not('status', 'in', '("passed","failed")').limit(5),
      supabase.from('projects').select('title,domain,progress,status')
        .eq('user_id', user.id).eq('status', 'active').limit(5),
      supabase.from('thesis_chapters').select('title,chapter_num,status,word_count,target_words')
        .eq('user_id', user.id).order('chapter_num').limit(6),
      supabase.from('notifications').select('title,type').eq('user_id', user.id).eq('read', false).limit(3),
    ])

    const liveContext = `
CURRENT CONTEXT (live data):
Open tasks: ${tasksR.data?.map(t => `${t.title} [${t.priority}/${t.domain}]`).join('; ') || 'none'}
Academic modules: ${modulesR.data?.map(m => `${m.title} [${m.status}]`).join('; ') || 'none'}
Active projects: ${projectsR.data?.map(p => `${p.title} ${p.progress}%`).join('; ') || 'none'}
Thesis chapters: ${chaptersR.data?.map(c => `Ch${c.chapter_num} ${c.status} ${c.word_count}/${c.target_words}w`).join('; ') || 'none'}
Unread alerts: ${notifsR.data?.map(n => `${n.title} [${n.type}]`).join('; ') || 'none'}
Today: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
`

    const domainPrefix = domainContext ? `\nDOMAIN FOCUS FOR THIS CONVERSATION:\n${domainContext}\n` : ''

    const system = `You are PIOS AI — Douglas Masuku's personal intelligent operating system companion.

Douglas is:
- Group CEO, Sustain International FZE Ltd (UAE/UK holding company)
- DBA candidate, University of Portsmouth (research: AI-enabled forecasting in GCC FM contexts, STS + sensemaking theory)
- FM consultant (Qiddiya RFP QPMO-410-CT-07922 active, KSP reference deployment SAR 229.6M)
- SaaS founder: SustainEdge v5.2 (service charge platform, live), InvestiScript v3 (AI journalism, live), PIOS v1.0 (this platform, just launched)
- Key IP: HDCA (patent pending), SE-CAFX climate adjustment factors, SE-PMF methodology

You have full access to his live data. Be direct, concise, action-oriented. Surface cross-domain conflicts. No unnecessary pleasantries.

${liveContext}${domainPrefix}`

    const reply = await callClaude(messages, system, 1000)
    return NextResponse.json({ reply })
  } catch (err: any) {
    console.error('AI chat error:', err)
    return NextResponse.json({ error: err.message ?? 'AI unavailable. Please try again.' }, { status: 500 })
  }
}
