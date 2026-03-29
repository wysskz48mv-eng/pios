/**
 * /api/meetings — Meeting Notes & Action Item Extraction
 * Closes the Otter.ai gap: transcript/notes → AI decisions + action items → tasks
 *
 * GET    ?domain=&status=&limit=  — list meeting notes
 * POST   { action: 'create' | 'process' | 'promote_tasks', ...(body as Record<string,unknown>) }
 * PATCH  { id, ...(updates as Record<string,unknown>) }
 * DELETE ?id=
 *
 * Flow:
 *   1. User pastes transcript or writes notes → POST action=create
 *   2. AI processes text → extracts decisions, action items, risks → POST action=process
 *   3. User reviews → POST action=promote_tasks → creates tasks table entries
 *
 * Supports: Zoom/Teams/Meet transcripts (pasted), voice notes, manual notes.
 * No bot infrastructure required — paste-based approach works with any platform.
 *
 * PIOS v3.0 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { callClaude, PIOS_SYSTEM }   from '@/lib/ai/client'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

export const runtime = 'nodejs'
export const maxDuration = 60

const VALID_TYPES   = ['general','supervision','board','client','team','interview','consultation','viva','review','one_on_one','other']
const VALID_DOMAINS = ['academic','fm_consulting','saas','business','personal']

// ── GET ────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp     = req.nextUrl.searchParams
  const domain = sp.get('domain')
  const status = sp.get('status')
  const limit  = Math.min(parseInt(sp.get('limit') ?? '50'), 200)

  let q = supabase.from('meeting_notes').select('*')
    .eq('user_id', user.id)
    .order('meeting_date', { ascending: false })
    .order('created_at',   { ascending: false })
    .limit(limit)

  if (domain && domain !== 'all') q = q.eq('domain', domain)
  if (status && status !== 'all') q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })

  // Strip raw_transcript from list view (large field — fetch on demand)
  const meetings = (data ?? []).map((m: Record<string, unknown>) => {
    const { raw_transcript, ...rest } = m as any
    return { ...rest, has_transcript: !!raw_transcript }
  })

  return NextResponse.json({ meetings, count: meetings.length })
}

// ── POST ───────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  const { action } = body

  // ── CREATE ──────────────────────────────────────────────────────────────────
  if (!action || action === 'create') {
    const {
      title, meeting_date, duration_mins, attendees, meeting_type = 'general',
      domain = 'business', location, platform,
      raw_transcript, raw_notes, input_method = 'manual',
      calendar_event_id, is_confidential = false,
      auto_process = true,  // if true, immediately run AI extraction
    } = body

    if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })
    if (meeting_type && !VALID_TYPES.includes(meeting_type))
      return NextResponse.json({ error: 'invalid meeting_type' }, { status: 400 })
    if (domain && !VALID_DOMAINS.includes(domain))
      return NextResponse.json({ error: 'invalid domain' }, { status: 400 })

    const { data: profile } = await supabase.from('user_profiles')
      .select('tenant_id').eq('id', user.id).single()

    const { data, error } = await supabase.from('meeting_notes').insert({
      user_id:          user.id,
      tenant_id:        profile?.tenant_id,
      calendar_event_id: calendar_event_id ?? null,
      title:            title.trim(),
      meeting_date:     meeting_date ?? new Date().toISOString().slice(0, 10),
      duration_mins:    duration_mins ?? null,
      attendees:        attendees ?? [],
      meeting_type,
      domain,
      location:         location ?? null,
      platform:         platform ?? null,
      raw_transcript:   raw_transcript?.trim() ?? null,
      raw_notes:        raw_notes?.trim() ?? null,
      input_method,
      is_confidential,
      status:           'draft',
      updated_at:       new Date().toISOString(),
    }).select().single()

    if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })

    // Auto-process if content provided and auto_process requested
    if (auto_process && (raw_transcript || raw_notes)) {
      const processed = await processMeetingNotes(supabase, data, user.id)
      return NextResponse.json({ meeting: processed }, { status: 201 })
    }

    return NextResponse.json({ meeting: data }, { status: 201 })
  }

  // ── PROCESS (AI extraction) ─────────────────────────────────────────────────
  if (action === 'process') {
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { data: meeting } = await supabase.from('meeting_notes')
      .select('*').eq('id', id).eq('user_id', user.id).single()
    if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const processed = await processMeetingNotes(supabase, meeting, user.id)
    return NextResponse.json({ meeting: processed })
  }

  // ── PROMOTE TASKS ───────────────────────────────────────────────────────────
  if (action === 'promote_tasks') {
    const { id, selected_items } = body  // selected_items: array of action item indices to promote
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { data: meeting } = await supabase.from('meeting_notes')
      .select('*').eq('id', id).eq('user_id', user.id).single()
    if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const actionItems: unknown[] = (meeting as any).ai_action_items ?? []
    const toPromote = selected_items
      ? actionItems.filter((_: unknown, i: number) => selected_items.includes(i))
      : actionItems

    if (toPromote.length === 0)
      return NextResponse.json({ error: 'No action items to promote' }, { status: 400 })

    const { data: profile } = await supabase.from('user_profiles')
      .select('tenant_id').eq('id', user.id).single()

    const taskIds: string[] = []

    for (const item of (toPromote as any[])) {
      const priority = (item as any).priority === 'critical' ? 'critical'
                     : (item as any).priority === 'high'     ? 'high'
                     : (item as any).priority === 'low'      ? 'low'
                     : 'medium'

      const { data: task, error: taskErr } = await supabase.from('tasks').insert({
        user_id:     user.id,
        tenant_id:   profile?.tenant_id,
        title:       (item as any).action ?? (item as any).description ?? 'Action from meeting',
        description: `From meeting: ${(meeting as any).title} (${(meeting as any).meeting_date}). Attendees: ${((meeting as any).attendees ?? []).join(', ') || '—'}`,
        domain:      (item as any).domain ?? (meeting as any).domain,
        priority,
        status:      'todo',
        due_date:    (item as any).due_date ?? null,
        source:      'meeting_notes',
        updated_at:  new Date().toISOString(),
      }).select('id').single()

      if (!taskErr && task) taskIds.push(task.id)
    }

    // Update meeting record
    await supabase.from('meeting_notes').update({
      tasks_created:    true,
      tasks_created_at: new Date().toISOString(),
      task_ids:         taskIds,
      status:           'reviewed',
      updated_at:       new Date().toISOString(),
    }).eq('id', id)

    return NextResponse.json({ tasks_created: taskIds.length, task_ids: taskIds })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}

// ── PATCH ──────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as any
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const allowed = ['title','meeting_date','duration_mins','attendees','meeting_type',
    'domain','location','platform','raw_transcript','raw_notes','status','is_confidential']
  const safe: Record<string,unknown> = { updated_at: new Date().toISOString() }
  for (const k of (allowed as any[])) { if (k in updates) safe[k] = updates[k] }

  if (updates.domain && !VALID_DOMAINS.includes(updates.domain))
    return NextResponse.json({ error: 'invalid domain' }, { status: 400 })

  const { data, error } = await supabase.from('meeting_notes')
    .update(safe).eq('id', id).eq('user_id', user.id).select().single()

  if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  return NextResponse.json({ meeting: data })
}

// ── DELETE ──────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('meeting_notes')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', user.id)

  if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  return NextResponse.json({ archived: true })
}

// ── AI Processing ──────────────────────────────────────────────────────────────
async function processMeetingNotes(supabase: any, meeting: unknown, userId: string) {
  const content = (meeting as any).raw_transcript || (meeting as any).raw_notes || ''
  if (!content.trim()) return meeting

  const contextHint = (meeting as any).meeting_type === 'supervision'
    ? 'This is a DBA supervision session at University of Portsmouth.'
    : (meeting as any).meeting_type === 'client'
    ? 'This is a client meeting in an FM consulting or SaaS context.'
    : (meeting as any).meeting_type === 'board'
    ? 'This is a board or senior leadership meeting.'
    : `This is a ${(meeting as any).meeting_type} meeting.`

  const system = `${PIOS_SYSTEM}

You are extracting structured intelligence from meeting notes or transcripts.
${contextHint} Domain: ${(meeting as any).domain}. Date: ${(meeting as any).meeting_date}.
Attendees: ${((meeting as any).attendees ?? []).join(', ') || 'not specified'}.

Return ONLY valid JSON — no preamble, no markdown:
{
  "summary": "3-5 sentence narrative summary of the meeting",
  "decisions": [
    { "decision": "what was decided", "owner": "name or role", "date": "YYYY-MM-DD or null" }
  ],
  "action_items": [
    { "action": "clear actionable task", "owner": "name or role (or 'Douglas' if unspecified)", "due_date": "YYYY-MM-DD or null", "priority": "critical|high|medium|low", "domain": "${VALID_DOMAINS.join('|')}" }
  ],
  "follow_ups": [
    { "topic": "topic needing follow-up", "context": "why", "by_when": "YYYY-MM-DD or null" }
  ],
  "risks": [
    { "risk": "risk identified", "severity": "high|medium|low", "mitigation": "suggested mitigation or null" }
  ]
}`

  try {
    const raw = await callClaude(
      [{ role: 'user', content: `Meeting: ${(meeting as any).title}\n\n${content.slice(0, 8000)}` }],
      system,
      2000,
    )

    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())

    const updates: any = {
      ai_summary:      (parsed as any)?.summary      ?? null,
      ai_decisions:    (parsed as any)?.decisions    ?? [],
      ai_action_items: (parsed as any)?.action_items ?? [],
      ai_follow_ups:   (parsed as any)?.follow_ups   ?? [],
      ai_risks:        (parsed as any)?.risks        ?? [],
      ai_processed_at: new Date().toISOString(),
      status:          'processed',
      updated_at:      new Date().toISOString(),
    }

    const { data: updated } = await supabase.from('meeting_notes')
      .update(updates).eq('id', (meeting as any).id).select().single()

    return updated ?? { ...(meeting as Record<string,unknown>), ...(updates as Record<string,unknown>) }

  } catch (err: unknown) {
    await supabase.from('meeting_notes').update({
      status: 'processed',
      ai_summary: 'AI processing failed — review transcript manually.',
      updated_at: new Date().toISOString(),
    }).eq('id', (meeting as any).id)
    return meeting
  }
}
