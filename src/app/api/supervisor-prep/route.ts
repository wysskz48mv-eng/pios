/**
 * GET  /api/supervisor-prep         — upcoming meeting prep + history
 * POST /api/supervisor-prep         — create meeting prep note
 * POST /api/supervisor-prep?action=ai-agenda — AI meeting agenda generator
 * POST /api/supervisor-prep?action=ai-brief  — AI pre-meeting brief
 * POST /api/supervisor-prep?action=ai-debrief — AI post-meeting action plan
 *
 * Supervisor meeting preparation tool for Portsmouth DBA candidates.
 * Helps structure supervisor meetings, track agreed actions,
 * and maintain a progress narrative for the examination record.
 *
 * PIOS™ v3.6.1 | Sprint N — Supervisor Prep | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import Anthropic                     from '@anthropic-ai/sdk'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60
const anthropic = new Anthropic()

// Portsmouth DBA supervisors
const SUPERVISORS = [
  { id:'bak',       name:'Dr Ozlem Bak',        specialisms:['organisational learning','knowledge management','HR development'], email:'ozlem.bak@port.ac.uk' },
  { id:'sreedharan', name:'Dr Raja Sreedharan',  specialisms:['operations management','quality','process improvement','Lean'], email:'raja.sreedharan@port.ac.uk' },
]

// DBA milestone types for progress tracking
const MEETING_TYPES = ['Progress review','Chapter feedback','Methodology discussion','Literature review','Viva preparation','Transfer review','Annual review','Informal check-in']

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: meetings } = await supabase
      .from('supervisor_meetings')
      .select('id,supervisor_id,meeting_type,meeting_date,agenda_items,agreed_actions,notes,status,created_at')
      .eq('user_id', user.id)
      .order('meeting_date', { ascending: false })
      .limit(20)

    const { data: chapters } = await supabase
      .from('thesis_chapters')
      .select('chapter_num,title,status,word_count,target_words,key_themes')
      .eq('user_id', user.id)
      .order('chapter_num')

    const meetingList = meetings ?? []
    const upcoming    = meetingList.filter(m => m.status === 'scheduled' && m.meeting_date >= new Date().toISOString().slice(0,10))
    const completed   = meetingList.filter(m => m.status === 'completed')
    const overdueActions = meetingList
      .flatMap(m => (m.agreed_actions ?? []).filter((a: any) => !a.completed && a.due_date < new Date().toISOString().slice(0,10)))

    return NextResponse.json({
      ok: true,
      meetings: meetingList,
      upcoming_count:    upcoming.length,
      completed_count:   completed.length,
      overdue_actions:   overdueActions.length,
      chapters:          chapters ?? [],
      supervisors:       SUPERVISORS,
      meeting_types:     MEETING_TYPES,
    })
  } catch (err: any) {
    console.error('[PIOS supervisor-prep GET]', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')
    const body   = await req.json()

    // ── AI agenda generator ────────────────────────────────────────────────
    if (action === 'ai-agenda') {
      const { supervisor_id, meeting_type, chapters, recent_work, open_questions } = body
      const supervisor = SUPERVISORS.find(s => s.id === supervisor_id) ?? SUPERVISORS[0]
      const chapterList = (chapters as any[])?.map((c: any) => `Ch${c.chapter_num} ${c.title}: ${c.status} (${c.word_count ?? 0}/${c.target_words ?? 8000}w)`).join('\n') ?? ''

      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 700,
        messages: [{ role: 'user', content:
          `Portsmouth DBA candidate preparing for a supervisor meeting.\n\n` +
          `Supervisor: ${supervisor.name} — specialisms: ${supervisor.specialisms.join(', ')}\n` +
          `Meeting type: ${meeting_type ?? 'Progress review'}\n` +
          `Programme: DBA — AI-enabled FM cost forecasting, GCC master communities\n` +
          `Research methodology: Sociotechnical systems theory + sensemaking frameworks\n\n` +
          `Thesis chapter status:\n${chapterList}\n\n` +
          `Recent work: ${recent_work ?? 'Not specified'}\n` +
          `Open questions: ${open_questions ?? 'Not specified'}\n\n` +
          `Generate a structured meeting agenda covering:\n` +
          `1. PROGRESS UPDATE (2-3 specific items to report, including word counts and milestones)\n` +
          `2. QUESTIONS FOR SUPERVISOR (3-4 specific questions relevant to this supervisor's specialisms)\n` +
          `3. CHAPTERS REQUIRING FEEDBACK (which chapters need review and what specifically)\n` +
          `4. AGREED ACTIONS FROM LAST MEETING (flag any outstanding)\n` +
          `5. NEXT MILESTONE (what will be submitted/completed by next meeting)\n\n` +
          `Format as a clean meeting agenda. Be specific — reference actual chapter titles and themes.`
        }],
      })
      const agenda = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
      return NextResponse.json({ ok: true, action: 'ai-agenda', agenda, supervisor: supervisor.name })
    }

    // ── AI pre-meeting brief ───────────────────────────────────────────────
    if (action === 'ai-brief') {
      const { supervisor_id, meeting_date, last_meeting_notes, chapters } = body
      const supervisor = SUPERVISORS.find(s => s.id === supervisor_id) ?? SUPERVISORS[0]
      const chapterProgress = (chapters as any[])?.map((c: any) => `Ch${c.chapter_num}: ${c.status}, ${c.word_count ?? 0}w`).join(' | ') ?? ''

      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001', max_tokens: 400,
        messages: [{ role: 'user', content:
          `DBA candidate. Write a pre-meeting brief (max 150 words) for a session with ${supervisor.name}.\n\n` +
          `Meeting: ${meeting_date ?? 'upcoming'}\n` +
          `Chapter progress: ${chapterProgress}\n` +
          `Last meeting notes: ${last_meeting_notes ?? 'not available'}\n\n` +
          `Write: what to lead with, what to avoid, how to frame progress, one key question to ask.\n` +
          `Be specific to this supervisor's specialisms: ${supervisor.specialisms.join(', ')}.`
        }],
      })
      const brief = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
      return NextResponse.json({ ok: true, action: 'ai-brief', brief })
    }

    // ── AI post-meeting action plan ────────────────────────────────────────
    if (action === 'ai-debrief') {
      const { raw_notes, supervisor_id } = body
      if (!raw_notes) return NextResponse.json({ error: 'raw_notes required' }, { status: 400 })

      const supervisor = SUPERVISORS.find(s => s.id === supervisor_id) ?? SUPERVISORS[0]
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 700,
        messages: [{ role: 'user', content:
          `DBA supervisor meeting debrief processor.\n\n` +
          `Supervisor: ${supervisor.name}\n` +
          `Raw meeting notes:\n"""\n${raw_notes.slice(0, 3000)}\n"""\n\n` +
          `Extract and structure as JSON (no markdown):\n` +
          `{\n` +
          `  "meeting_summary": "<2 sentence summary of what was discussed>",\n` +
          `  "agreed_actions": [{"action": "<specific task>", "due_date": "<YYYY-MM-DD or null>", "priority": "high"|"medium"|"low"}],\n` +
          `  "supervisor_feedback": [<key feedback points from supervisor>],\n` +
          `  "chapters_to_revise": [<chapter numbers that need revision>],\n` +
          `  "methodology_notes": "<any methodology guidance given>",\n` +
          `  "next_meeting_focus": "<what to focus on before next meeting>",\n` +
          `  "viva_readiness_note": "<any comment on viva progression or readiness>"\n` +
          `}`
        }],
      })
      const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : '{}'
      try {
        const debrief = JSON.parse(raw.replace(/```json|```/g,'').trim())
        // Save to supervisor_meetings
        await supabase.from('supervisor_meetings').insert({
          user_id:        user.id,
          supervisor_id:  supervisor_id ?? 'bak',
          meeting_type:   'Progress review',
          notes:          raw_notes,
          agreed_actions: debrief.agreed_actions ?? [],
          status:         'completed',
          meeting_date:   new Date().toISOString().slice(0,10),
          created_at:     new Date().toISOString(),
        })
        return NextResponse.json({ ok: true, action: 'ai-debrief', debrief })
      } catch {
        return NextResponse.json({ ok: true, action: 'ai-debrief', raw })
      }
    }

    // ── Create meeting record ──────────────────────────────────────────────
    const { supervisor_id, meeting_type, meeting_date, agenda_items, notes } = body
    const { data } = await supabase.from('supervisor_meetings').insert({
      user_id:       user.id,
      supervisor_id: supervisor_id ?? 'bak',
      meeting_type:  meeting_type ?? 'Progress review',
      meeting_date:  meeting_date ?? new Date().toISOString().slice(0,10),
      agenda_items:  agenda_items ?? [],
      notes:         notes ?? null,
      agreed_actions:[],
      status:        'scheduled',
      created_at:    new Date().toISOString(),
    }).select('id,supervisor_id,meeting_date,status').single()

    return NextResponse.json({ ok: true, meeting: data ?? { supervisor_id, meeting_date, status:'scheduled' } })
  } catch (err: any) {
    console.error('[PIOS supervisor-prep POST]', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}
