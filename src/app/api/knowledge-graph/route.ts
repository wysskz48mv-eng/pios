/**
 * GET  /api/knowledge-graph   — build knowledge graph from PIOS data
 * POST /api/knowledge-graph   — AI synthesis: connections + recommendations
 *   actions: synthesise | gap-analysis | weekly-brief
 *
 * Aggregates data from: insights, tasks, meeting notes, literature,
 * DBA chapters, viva Q&A sessions → structured knowledge graph nodes/edges.
 *
 * PIOS™ v3.3.0 | Sprint H — Knowledge Graph | VeritasIQ Technologies Ltd
 */
import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { callClaude }                from '@/lib/ai/client'

export const dynamic = 'force-dynamic'

type SBRow = Record<string, unknown>

// Node type → colour + shape metadata
const NODE_META: Record<string, { colour: string; icon: string; category: string }> = {
  insight:     { colour: '#4f8ef7', icon: '💡', category: 'capture'     },
  task:        { colour: '#22c55e', icon: '✓',  category: 'execution'   },
  meeting:     { colour: '#9c6ef7', icon: '🎯', category: 'collaboration'},
  literature:  { colour: '#f59e0b', icon: '📚', category: 'research'    },
  chapter:     { colour: '#ef4444', icon: '📝', category: 'dba'         },
  concept:     { colour: '#14b8a6', icon: '◆',  category: 'knowledge'   },
  framework:   { colour: '#C9A84C', icon: '⬡',  category: 'professional'},
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const days   = parseInt(searchParams.get('days') ?? '30')
    const domain = searchParams.get('domain') // professional|academic|all
    const since  = new Date(Date.now() - days * 86400_000).toISOString()

    // Parallel fetch from all PIOS data sources
    const [insights, tasks, meetings, chapters, literature] = await Promise.all([
      supabase.from('insights').select('id,content,category,created_at,tags').eq('user_id', user.id)
        .gte('created_at', since).order('created_at',{ascending:false}).limit(50),
      supabase.from('tasks').select('id,title,status,priority,category,due_date').eq('user_id', user.id)
        .gte('created_at', since).order('created_at',{ascending:false}).limit(50),
      supabase.from('meeting_notes').select('id,title,ai_summary,ai_action_items,created_at').eq('user_id', user.id)
        .gte('created_at', since).order('created_at',{ascending:false}).limit(20),
      supabase.from('thesis_chapters').select('id,chapter_num,title,word_count,status,key_themes').eq('user_id', user.id).limit(15),
      supabase.from('literature_items').select('id,title,authors,year,themes,status').eq('user_id', user.id)
        .gte('created_at', since).limit(20),
    ])

    // Build nodes
    const nodes: SBRow[] = []
    const edges: Array<{ source: string; target: string; type: string; weight: number }> = []
    const edgeSet = new Set<string>()

    const addEdge = (a: string, b: string, type: string, w = 1) => {
      const key = [a, b].sort().join('|') + type
      if (!edgeSet.has(key)) { edgeSet.add(key); edges.push({ source: a, target: b, type, weight: w }) }
    }

    // Insight nodes
    for (const ins of (insights.data ?? [])) {
      nodes.push({ id: `ins-${ins.id}`, label: String(ins.content ?? '').slice(0, 40), type: 'insight',
        ...NODE_META.insight, full: ins.content, tags: ins.tags, ts: ins.created_at })
    }

    // Task nodes
    for (const t of (tasks.data ?? [])) {
      if (domain && domain !== 'all') {
        const cat = String(t.category ?? '').toLowerCase()
        if (domain === 'professional' && cat.includes('academic')) continue
        if (domain === 'academic' && !cat.includes('academic') && !cat.includes('dba')) continue
      }
      nodes.push({ id: `tsk-${t.id}`, label: String(t.title ?? '').slice(0, 35), type: 'task',
        ...NODE_META.task, status: t.status, priority: t.priority })
    }

    // Meeting nodes + connect to tasks from action items
    for (const m of (meetings.data ?? [])) {
      nodes.push({ id: `mtg-${m.id}`, label: String(m.title ?? 'Meeting').slice(0, 35), type: 'meeting',
        ...NODE_META.meeting, summary: String(m.ai_summary ?? '').slice(0, 100) })
      // Connect meetings to tasks that share keywords
      const actionItems: any[] = (m.ai_action_items as any[]) ?? []
      for (const task of (tasks.data ?? [])) {
        if (actionItems.some((a: any) => String(task.title).toLowerCase().split(' ')
          .some(w => w.length > 4 && String(a.task ?? '').toLowerCase().includes(w)))) {
          addEdge(`mtg-${m.id}`, `tsk-${task.id}`, 'action_derived', 2)
        }
      }
    }

    // Chapter nodes (DBA)
    for (const ch of (chapters.data ?? [])) {
      nodes.push({ id: `ch-${ch.id}`, label: `Ch${ch.chapter_num}: ${String(ch.title ?? '').slice(0,25)}`, type: 'chapter',
        ...NODE_META.chapter, word_count: ch.word_count, status: ch.status })
      // Connect chapters to literature
      for (const lit of (literature.data ?? [])) {
        const themes: string[] = (ch.key_themes as string[]) ?? []
        const litThemes: string[] = (lit.themes as string[]) ?? []
        if (themes.some(t => litThemes.includes(t))) {
          addEdge(`ch-${ch.id}`, `lit-${lit.id}`, 'theoretical_link', 1)
        }
      }
    }

    // Literature nodes
    for (const lit of (literature.data ?? [])) {
      nodes.push({ id: `lit-${lit.id}`, label: String(lit.title ?? '').slice(0, 35), type: 'literature',
        ...NODE_META.literature, year: lit.year, authors: lit.authors })
    }

    // Connect insights to relevant tasks/meetings by keyword overlap
    for (const ins of nodes.filter(n => n.type === 'insight')) {
      const insWords = String(ins.full ?? ins.label).toLowerCase().split(/\s+/).filter((w: string) => w.length > 5)
      for (const task of nodes.filter(n => n.type === 'task')) {
        if (insWords.some((w: string) => String(task.label).toLowerCase().includes(w))) {
          addEdge(String(ins.id), String(task.id), 'insight_to_task', 1)
        }
      }
    }

    // PIOS proprietary frameworks as concept nodes
    const frameworks = ['SDL','POM','OAE','CVDM','CPA','NemoClaw'].map(f => ({
      id: `fw-${f}`, label: f, type: 'framework', ...NODE_META.framework
    }))
    for (const fw of frameworks) {
      nodes.push(fw)
      // Connect to tasks with matching keywords
      for (const task of nodes.filter(n => n.type === 'task')) {
        if (String(task.label).toLowerCase().includes(fw.label.toLowerCase())) {
          addEdge(fw.id, String(task.id), 'framework_applied', 2)
        }
      }
    }

    // Position nodes in domain clusters
    const clusterPos: Record<string, { cx: number; cy: number }> = {
      capture: { cx: 200, cy: 200 }, execution: { cx: 550, cy: 150 },
      collaboration: { cx: 500, cy: 380 }, research: { cx: 200, cy: 380 },
      dba: { cx: 350, cy: 480 }, professional: { cx: 700, cy: 300 },
    }
    nodes.forEach((n, i) => {
      const cluster = clusterPos[String(n.category)] ?? { cx: 400, cy: 300 }
      const angle   = (2 * Math.PI * i) / Math.max(nodes.length, 1)
      const radius  = 80 + Math.random() * 60
      n.x = cluster.cx + Math.cos(angle) * radius
      n.y = cluster.cy + Math.sin(angle) * radius
    })

    return NextResponse.json({
      ok: true,
      nodes: nodes.slice(0, 80),
      edges: edges.slice(0, 150),
      stats: {
        total_nodes: nodes.length, total_edges: edges.length,
        by_type: Object.fromEntries(Object.keys(NODE_META).map(t => [t, nodes.filter(n => n.type === t).length])),
        days_window: days,
      },
    })
  } catch (err: any) {
    console.error('[PIOS knowledge-graph GET]', err)
    return apiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action, nodes, stats } = body

    if (action === 'synthesise') {
      const nodeList = (nodes as SBRow[] ?? []).slice(0, 20)
        .map(n => `[${n.type}] ${n.label}`)
        .join('\n')

      const synthesis = await callClaude(
        [{ role: 'user', content:
          `PIOS Chief of Staff. Synthesise the user's knowledge graph — what is the user actually working on and what matters most?\n\n` +
          `Knowledge nodes (last ${stats?.days_window ?? 30} days):\n${nodeList}\n\n` +
          `Graph stats: ${stats?.total_nodes ?? 0} nodes, ${stats?.total_edges ?? 0} connections\n\n` +
          `Provide:\n` +
          `1. SYNTHESIS (2-3 sentences — what is the overarching theme or focus right now?)\n` +
          `2. TOP CONNECTIONS (2-3 most important cross-domain connections you see in this graph)\n` +
          `3. ENERGY CONCENTRATION (where is the user spending most cognitive effort?)\n` +
          `4. RECOMMENDED FOCUS (what single area would create the most leverage this week?)\n\n` +
          `Be direct, specific, and action-oriented. Reference actual node labels.`
        }],
        'You are the PIOS Chief of Staff. Produce concrete synthesis with explicit cross-domain links and leverage points.',
        700,
        'sonnet'
      )
      return NextResponse.json({ ok: true, action: 'synthesise', synthesis })
    }

    if (action === 'gap-analysis') {
      const nodeList = (nodes as SBRow[] ?? []).slice(0, 20).map(n => `[${n.type}] ${n.label}`).join('\n')
      const gaps = await callClaude(
        [{ role: 'user', content:
          `PIOS gap analyst. What is MISSING from this knowledge graph?\n\nNodes:\n${nodeList}\n\n` +
          `Identify:\n1. KNOWLEDGE GAPS (what topics are absent that should be connected?)\n` +
          `2. WEAK LINKS (connections that exist but need strengthening)\n` +
          `3. ORPHANED NODES (items that seem isolated — no connections — and why that's a risk)\n` +
          `4. DBA ALIGNMENT (is the academic work connected to the professional practice? What's the bridge?)\n\n` +
          `Reference specific node labels. Be concrete.`
        }],
        'You are a graph gap analyst. Identify missing links, blind spots, and concrete integration opportunities.',
        500,
        'sonnet'
      )
      return NextResponse.json({ ok: true, action: 'gap-analysis', gaps })
    }

    if (action === 'weekly-brief') {
      const nodeList = (nodes as SBRow[] ?? []).slice(0, 25).map(n => `[${n.type}] ${n.label}`).join('\n')
      const brief = await callClaude(
        [{ role: 'user', content:
          `PIOS Weekly Intelligence Brief. Based on the knowledge graph, generate a structured weekly brief.\n\n` +
          `Graph nodes:\n${nodeList}\n\n` +
          `Write as Chief of Staff. Include:\n` +
          `WEEK IN REVIEW: (2 sentences — what was accomplished)\n` +
          `MOMENTUM ITEMS: (3 bullets — what has positive momentum)\n` +
          `AT-RISK ITEMS: (2 bullets — what is stalling or overdue)\n` +
          `THIS WEEK'S PRIORITY: (1 clear directive)\n` +
          `DBA PROGRESS NOTE: (1 sentence on academic progress vs professional work balance)\n\n` +
          `Reference specific items by name. Be direct. No padding.`
        }],
        'You are the PIOS Chief of Staff. Write concise, structured weekly intelligence briefings grounded in named items.',
        600,
        'sonnet'
      )
      return NextResponse.json({ ok: true, action: 'weekly-brief', brief })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err: any) {
    console.error('[PIOS knowledge-graph POST]', err)
    return apiError(err)
  }
}
