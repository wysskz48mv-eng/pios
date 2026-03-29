/**
 * POST /api/meetings/live — Agentic Meeting Intelligence
 *
 * Processes live meeting transcript fragments in real-time.
 * Extracts: decisions, action items, risks, follow-ups, commitments.
 * Auto-triggers Chief of Staff briefing on completion.
 *
 * Actions:
 *   process   — extract structured intelligence from transcript fragment
 *   complete  — finalise meeting, generate CoS briefing + task creation
 *   summary   — generate executive meeting summary
 *
 * PIOS™ v3.3.0 | Sprint F — Agentic Meetings | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import Anthropic                     from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action, transcript, meetingTitle, attendees, meetingId, context } = body
    const when = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })

    // ── Action: process — extract structured intelligence ─────────────────
    if (action === 'process' || !action) {
      if (!transcript) return NextResponse.json({ error: 'transcript required' }, { status: 400 })

      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 1200,
        messages: [{ role: 'user', content:
          `You are an agentic meeting intelligence system for a CEO/Founder/DBA candidate.
Meeting: "${meetingTitle ?? 'Untitled meeting'}"
Date: ${when}
Attendees: ${attendees ?? 'not specified'}
${context ? `Context: ${context}` : ''}

Extract structured intelligence from this transcript:

"""
${transcript.slice(0, 4000)}
"""

Respond with JSON (no markdown):
{
  "decisions": [{"decision": <string>, "owner": <string|null>, "deadline": <string|null>, "confidence": <"firm"|"tentative"|"deferred">}],
  "action_items": [{"task": <string>, "owner": <string|null>, "deadline": <string|null>, "priority": <"urgent"|"high"|"normal">, "category": <"internal"|"external"|"research"|"admin">}],
  "commitments": [{"commitment": <string>, "made_by": <string|null>, "to": <string|null>, "by_when": <string|null>}],
  "risks_flagged": [{"risk": <string>, "severity": <"critical"|"high"|"medium">, "mitigation": <string|null>}],
  "follow_ups_required": [{"topic": <string>, "who": <string|null>, "by_when": <string|null>}],
  "key_insights": [<up to 3 key insights or breakthroughs from this meeting>],
  "topics_covered": [<brief list of topics discussed>],
  "meeting_health": <"productive"|"off-track"|"inconclusive"|"excellent">
}`
        }],
      })

      const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : '{}'
      let intelligence: any = {}
      try { intelligence = JSON.parse(raw.replace(/```json|```/g, '').trim()) } catch { /* use raw */ }

      return NextResponse.json({
        ok: true,
        action: 'process',
        intelligence,
        meeting_title: meetingTitle,
        processed_at: new Date().toISOString(),
        transcript_length: transcript.length,
      })
    }

    // ── Action: complete — finalise + CoS briefing + auto-create tasks ────
    if (action === 'complete') {
      const intelligence = body.intelligence ?? {}
      const actionItems: any[] = intelligence.action_items ?? []

      // Auto-create tasks in PIOS from action items
      const tasksCreated: any[] = []
      for (const item of actionItems.slice(0, 10)) {
        if (!item.task) continue
        const { data: task } = await supabase.from('tasks').insert({
          user_id:     user.id,
          title:       item.task,
          description: `From meeting: ${meetingTitle ?? 'Untitled'} · Owner: ${item.owner ?? 'unassigned'}`,
          priority:    item.priority ?? 'normal',
          status:      'todo',
          due_date:    item.deadline ? new Date(item.deadline).toISOString() : null,
          source:      'meeting_intelligence',
          created_at:  new Date().toISOString(),
        }).select('id,title').single()
        if (task) tasksCreated.push(task)
      }

      // Generate Chief of Staff briefing
      const cosMsg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 600,
        messages: [{ role: 'user', content:
          `Chief of Staff briefing for CEO/Founder after a meeting.

Meeting: "${meetingTitle ?? 'Meeting'}" on ${when}
Decisions: ${JSON.stringify(intelligence.decisions ?? [])}
Action items: ${JSON.stringify((intelligence.action_items ?? []).slice(0, 5))}
Risks: ${JSON.stringify(intelligence.risks_flagged ?? [])}
Key insights: ${JSON.stringify(intelligence.key_insights ?? [])}

Write a 3-paragraph executive briefing:
1. What was decided and why it matters
2. Your top 3 priorities coming out of this meeting (be direct)
3. What needs the CEO's attention in the next 48 hours

Write in first person as Chief of Staff. Be direct, specific, and action-oriented. No fluff.`
        }],
      })
      const cosBriefing = cosMsg.content[0]?.type === 'text' ? cosMsg.content[0].text : ''

      // Log to meeting_notes if meetingId provided
      if (meetingId) {
        await supabase.from('meeting_notes').update({
          ai_summary:      cosBriefing,
          ai_action_items: intelligence.action_items ?? [],
          status:          'processed',
        }).eq('id', meetingId).eq('user_id', user.id)
      }

      return NextResponse.json({
        ok: true,
        action: 'complete',
        cos_briefing: cosBriefing,
        tasks_created: tasksCreated.length,
        tasks: tasksCreated,
        intelligence,
      })
    }

    // ── Action: summary — quick executive summary ─────────────────────────
    if (action === 'summary') {
      const intelligence = body.intelligence ?? {}
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 400,
        messages: [{ role: 'user', content:
          `Write a 5-bullet executive summary of this meeting for a CEO.

Meeting: "${meetingTitle ?? 'Meeting'}" | ${when}
Topics: ${JSON.stringify(intelligence.topics_covered ?? [])}
Decisions: ${JSON.stringify(intelligence.decisions ?? [])}
Actions: ${JSON.stringify((intelligence.action_items ?? []).map((a: any) => a.task))}
Health: ${intelligence.meeting_health ?? 'unknown'}

Format: 5 bullets, max 15 words each. Lead with the most important outcome. Be crisp.`
        }],
      })
      const summary = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
      return NextResponse.json({ ok: true, action: 'summary', summary, meeting_title: meetingTitle })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })

  } catch (err: any) {
    console.error('[PIOS meetings/live]', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}
