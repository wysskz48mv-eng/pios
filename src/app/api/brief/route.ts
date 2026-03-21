import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'

export const runtime = 'nodejs'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)

  const [tasksR, modulesR, projectsR, notifsR, chaptersR, fmNewsR, cfpR] = await Promise.all([
  try {
      supabase.from('tasks').select('title,domain,priority,due_date,status')
        .eq('user_id', user.id).not('status', 'in', '("done","cancelled")')
        .order('due_date', { ascending: true }).limit(10),
      supabase.from('academic_modules').select('title,status,deadline,module_type')
        .eq('user_id', user.id).not('status', 'in', '("passed","failed")').limit(6),
      supabase.from('projects').select('title,domain,status,progress')
        .eq('user_id', user.id).eq('status', 'active').limit(6),
      supabase.from('notifications').select('title,type,domain')
        .eq('user_id', user.id).eq('read', false).limit(5),
      supabase.from('thesis_chapters').select('title,chapter_num,status,word_count,target_words')
        .eq('user_id', user.id).order('chapter_num').limit(6),
      supabase.from('fm_news_items').select('headline,category,relevance,summary')
        .eq('user_id', user.id)
        .gte('fetched_at', new Date(Date.now() - 86400000).toISOString())
        .order('relevance', { ascending: false }).limit(5),
      supabase.from('paper_calls').select('title,journal_name,deadline,relevance_score')
        .eq('user_id', user.id).in('status', ['new','considering','planning'])
        .gte('deadline', new Date().toISOString().slice(0,10))
        .lte('deadline', new Date(Date.now() + 30*86400000).toISOString().slice(0,10))
        .order('deadline').limit(3),
    ])

    const ctx = `
  Today: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

  OPEN TASKS (${tasksR.data?.length}):
  ${tasksR.data?.map(t => `- [${t.priority}] ${t.title} (${t.domain}) — ${t.due_date ? new Date(t.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'no deadline'}`).join('\n')}

  ACADEMIC MODULES:
  ${modulesR.data?.map(m => `- ${m.title} [${m.status}] — deadline: ${m.deadline ? new Date(m.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBD'}`).join('\n')}

  THESIS CHAPTERS:
  ${chaptersR.data?.map(c => `- Ch${c.chapter_num}: ${c.title} [${c.status}] — ${c.word_count}/${c.target_words} words`).join('\n')}

  ACTIVE PROJECTS:
  ${projectsR.data?.map(p => `- ${p.title} (${p.domain}) — ${p.progress}% complete`).join('\n')}

  UNREAD ALERTS:
  ${notifsR.data?.map(n => `- [${n.type.toUpperCase()}] ${n.title}`).join('\n') || 'None'}

  FM INTELLIGENCE (top signals, last 24h):
  ${fmNewsR.data && fmNewsR.data.length > 0
    ? fmNewsR.data.map((n: any) => `- [${n.category.toUpperCase()}] ${n.headline}`).join('\n')
    : 'No FM news cached — refresh feeds in Command Centre'}

  PUBLICATION DEADLINES (next 30 days):
  ${cfpR.data && cfpR.data.length > 0
    ? cfpR.data.map((c: any) => `- "${c.title}" (${c.journal_name ?? 'journal'}) — due ${c.deadline}`).join('\n')
    : 'No imminent CFP deadlines tracked'}
  `

    // Fetch live platform data (non-blocking)
    let liveCtx = ''
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const [seRes, isRes, ghRes] = await Promise.all([
        fetch(`${appUrl}/api/live/sustainedge`).then(r => r.json()).catch(() => null),
        fetch(`${appUrl}/api/live/investiscript`).then(r => r.json()).catch(() => null),
        fetch(`${appUrl}/api/live/github`).then(r => r.json()).catch(() => null),
      ])
      if (seRes?.connected && seRes.snapshot) {
        const s = seRes.snapshot
        liveCtx += `
  SUSTAINEDGE LIVE: ${s.tenants?.total ?? 0} tenants · ${s.assets?.total ?? 0} assets · OBE engine: ${s.obe?.engine ?? 'not run'}`
      }
      if (isRes?.connected && isRes.snapshot) {
        const i = isRes.snapshot
        liveCtx += `
  INVESTISCRIPT LIVE: ${i.users?.total ?? 0} users · ${i.users?.activeTrial ?? 0} active trials · ${i.subscriptions?.total ?? 0} paid subscribers`
      }
      if (ghRes?.connected && ghRes.repos) {
        const heads = Object.entries(ghRes.repos)
          .map(([, r]: [string, any]) => r.commits?.[0] ? `${r.label}@${r.commits[0].sha}` : null)
          .filter(Boolean).join(' · ')
        if (heads) liveCtx += `
  GITHUB HEADS: ${heads}`
      }
    } catch { /* silent */ }

    const system = `You are the PIOS AI Companion for Douglas Masuku — founder and Group CEO of Sustain International FZE Ltd, DBA candidate at University of Portsmouth, FM consultant, and technology entrepreneur building SustainEdge (service charge SaaS), InvestiScript (investigative journalism AI platform), and PIOS (personal AI operating system).

  Generate Douglas's daily morning brief. Be direct, concise, action-oriented. No pleasantries. No bullet points. 3-4 tight paragraphs.

  Paragraph 1: The single most important focus today and why.
  Paragraph 2: Cross-domain conflicts or risks you've spotted (academic deadlines clashing with business commitments, etc.).
  Paragraph 3: The 2-3 tasks requiring his personal attention today specifically — not just what's on the list.
  Paragraph 4 (optional): The most actionable FM intelligence signal from today's feeds — a market move, regulatory update, or research opportunity worth acting on this week.

  Maximum 300 words. Plain prose only. Never use bullet points or lists.`

    try {
      const content = await callClaude(
        [{ role: 'user', content: `Generate my morning brief.\n\n${ctx}${liveCtx ? '\n' + liveCtx : ''}` }],
        system, 700
      )
      await supabase.from('daily_briefs').upsert({
        user_id: user.id,
        brief_date: today,
        content,
        ai_model: 'claude-sonnet-4-20250514',
      }, { onConflict: 'user_id,brief_date' })
      return NextResponse.json({ content, brief_date: today })
    } catch (err) {
      console.error('Brief generation error:', err)
      return NextResponse.json({ error: 'Brief generation failed' }, { status: 500 })
    }

  } catch (err: any) {
    console.error('[PIOS] brief POST:', err.message)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }}
