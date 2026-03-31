/**
 * /api/academic — Academic lifecycle management
 * GET / POST / PATCH / DELETE for thesis chapters, modules, supervision sessions
 * PIOS v3.0 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { callClaude, PIOS_SYSTEM }   from '@/lib/ai/client'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

// ── Typed Supabase response helpers ──────────────────────────────────────────
type SBResult<T> = { data: T | null; error: { message: string } | null }
type SBRow = Record<string, unknown>


export const runtime = 'nodejs'

const CHAPTER_STATUSES = ['not_started','outline','drafting','draft_complete','submitted','passed','failed']
const MODULE_TYPES     = ['taught','research','thesis','viva','ethics','publication']
const MODULE_STATUSES  = ['upcoming','in_progress','submitted','passed','failed','deferred']
const SESSION_TYPES    = ['regular','panel','viva_mock','ethics','milestone']

// ── GET ────────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const [mods, chaps, sessions, snapshots] = await Promise.all([
      supabase.from('academic_modules').select('*').eq('user_id', user.id).order('sort_order'),
      supabase.from('thesis_chapters').select('*').eq('user_id', user.id).order('chapter_num'),
      supabase.from('supervision_sessions').select('*').eq('user_id', user.id).order('session_date', { ascending: false }).limit(20),
      supabase.from('thesis_weekly_snapshots').select('week_start,total_words,chapter_count,captured_at')
        .eq('user_id', user.id).order('week_start', { ascending: false }).limit(12),
    ])
    const chapters    = chaps.data ?? []
    const totalWords  = chapters.reduce((s, c) => s + (c.word_count  ?? 0), 0)
    const targetWords = chapters.reduce((s, c) => s + (c.target_words ?? 8000), 0)
    const snapshotData = snapshots.data ?? []
    // Compute weekly word delta (this week vs last week snapshot)
    const latestSnap   = snapshotData[0]
    const prevSnap     = snapshotData[1]
    const weeklyDelta  = (latestSnap && prevSnap)
      ? Math.max(0, (latestSnap.total_words ?? 0) - (prevSnap.total_words ?? 0))
      : null

    return NextResponse.json({
      modules:   mods.data     ?? [],
      chapters,
      sessions:  sessions.data ?? [],
      snapshots: snapshotData,
      thesis_summary: {
        total_words:   totalWords,
        target_words:  targetWords,
        pct_complete:  targetWords > 0 ? Math.round((totalWords / targetWords) * 100) : 0,
        chapters_done:  chapters.filter(c => ['submitted','passed','draft_complete'].includes(c.status)).length,
        chapters_total: chapters.length,
        weekly_delta:   weeklyDelta,
        last_snapshot:  latestSnap ?? null,
      },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal server error' }, { status: 500 })
  }
}

// ── POST ───────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body   = await req.json()
    const action = body.action

    // ── AI draft chapter section ──────────────────────────────────────
    if (action === 'ai_draft_section') {
      const { chapter_id, chapter_title, chapter_type, section_heading, section_notes,
              existing_content, literature_context, word_target = 500 } = body
      const { data: profile } = await supabase.from('user_profiles')
        .select('full_name,organisation').eq('id', user.id).single()
      const prof = profile as Record<string,unknown> | null

      const system = `You are an expert academic writing assistant helping ${prof?.full_name ?? 'the researcher'} write their DBA thesis at University of Portsmouth.
Research focus: AI-enabled FM cost forecasting and governance in GCC mixed-use developments.
Theoretical framework: Socio-technical systems theory + sensemaking theory.
Three-level evidential typology: Level 1 (technical feasibility), Level 2 (operational analytics), Level 3 (governance-integrated forecasting).
Context: VeritasEdge™ platform as the artefact; KSP-001 (King Salman Park) and Qiddiya City as case study sites.

Write in academic third-person prose. Use proper citation placeholders like (Author, Year) where evidence is needed.
Maintain consistent doctoral voice — rigorous but readable. No bullet points in the output — flowing paragraphs only.
Do NOT reproduce copyrighted text. Generate original academic writing only.`

      const prompt = `Write a ${word_target}-word draft for this thesis section:

Chapter ${chapter_type}: "${chapter_title}"
Section: "${section_heading}"
${section_notes ? `Section notes: ${section_notes}` : ''}
${existing_content ? `Existing content to build on:
${existing_content.slice(0, 2000)}` : ''}
${literature_context ? `Key literature to reference:
${literature_context.slice(0, 1000)}` : ''}

Write approximately ${word_target} words of rigorous academic prose for this section. Include:
- A clear topic sentence introducing the section's argument
- Evidence-based development with citation placeholders
- Critical engagement with relevant theory
- A linking sentence to the next logical section

Output the draft text only — no headers, no preamble.`

      const draft = await callClaude([{ role: 'user', content: prompt }], system, 2000)
      const wordCount = draft.split(/\s+/).filter(Boolean).length

      // Save draft to chapter content if chapter_id provided
      if (chapter_id) {
        await supabase.from('thesis_chapters')
          .update({ content: (existing_content ? existing_content + '\n\n' : '') + draft, updated_at: new Date().toISOString() })
          .eq('id', chapter_id).eq('user_id', user.id)
      }

      return NextResponse.json({ draft, wordCount, section_heading })
    }

    if (action === 'ai_thesis_review') {
      const { chapters, modules, programme_name, university, expected_graduation } = body
      const chapterSummary = (chapters ?? []).map((c: Record<string, unknown>) =>
        `Ch${c.chapter_num} "${c.title}": ${c.word_count ?? 0}/${c.target_words ?? 8000} words [${c.status}]`
      ).join('\n')
      const system = `${PIOS_SYSTEM}\nYou are reviewing Douglas's DBA thesis at ${university ?? 'University of Portsmouth'}.\nReturn ONLY valid JSON:\n{"overall_assessment":"string","pace_status":"on_track|at_risk|behind|ahead","pace_detail":"string","chapter_flags":[{"chapter_num":1,"flag":"behind|on_track|ahead","note":"string"}],"immediate_actions":["string"],"risk":"string"}`
      const raw = await callClaude([{ role:'user', content:`Review my DBA progress:\n\n${chapterSummary}\n\nModules:\n${(modules??[]).map((m: Record<string, unknown>)=>`- ${m.title} [${m.status}]${m.deadline?' · due '+m.deadline:''}`).join('\n')}` }], system, 600)
      try { return NextResponse.json({ review: JSON.parse(raw.replace(/```json|```/g,'').trim()) }) }
      catch { return NextResponse.json({ review: { overall_assessment: raw, pace_status: 'unknown' } }) }
    }

    const { data: profile } = await supabase.from('user_profiles').select('tenant_id').eq('id', user.id).single()

    if (action === 'create_chapter') {
      const { chapter_num, title, status='not_started', word_count=0, target_words=8000, notes } = body
      if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })
      if (!chapter_num)   return NextResponse.json({ error: 'chapter_num required' }, { status: 400 })
      if (!CHAPTER_STATUSES.includes(status)) return NextResponse.json({ error: 'invalid status' }, { status: 400 })
      const { data, error } = await supabase.from('thesis_chapters').insert({
        user_id: user.id, tenant_id: profile?.tenant_id,
        chapter_num: parseInt(chapter_num), title: title.trim(), status,
        word_count: parseInt(word_count)||0, target_words: parseInt(target_words)||8000,
        notes: notes??null, updated_at: new Date().toISOString(),
      }).select().single()
      if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })
      return NextResponse.json({ chapter: data }, { status: 201 })
    }

    if (action === 'create_module') {
      const { title, module_type='taught', status='upcoming', deadline, credits, sort_order } = body
      if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })
      if (!MODULE_TYPES.includes(module_type))  return NextResponse.json({ error: 'invalid module_type' }, { status: 400 })
      if (!MODULE_STATUSES.includes(status))    return NextResponse.json({ error: 'invalid status' }, { status: 400 })
      let order = sort_order
      if (order === undefined) {
        const { count } = await supabase.from('academic_modules').select('id',{count:'exact',head:true}).eq('user_id',user.id)
        order = count ?? 0
      }
      const { data, error } = await supabase.from('academic_modules').insert({
        user_id: user.id, tenant_id: profile?.tenant_id, title: title.trim(),
        module_type, status, deadline: deadline||null, credits: credits?parseInt(credits):null,
        sort_order: order, updated_at: new Date().toISOString(),
      }).select().single()
      if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })
      return NextResponse.json({ module: data }, { status: 201 })
    }

    if (action === 'create_session') {
      const { supervisor, session_date, format, duration_mins=60, notes, action_items, session_type='regular' } = body
      if (!session_date) return NextResponse.json({ error: 'session_date required' }, { status: 400 })
      if (!SESSION_TYPES.includes(session_type)) return NextResponse.json({ error: 'invalid session_type' }, { status: 400 })
      const items = action_items ? (Array.isArray(action_items) ? action_items : action_items.split('\n').filter(Boolean)) : []
      const { data, error } = await supabase.from('supervision_sessions').insert({
        user_id: user.id, tenant_id: profile?.tenant_id, supervisor: supervisor??null,
        session_date, session_type, format: format??null, duration_mins: parseInt(duration_mins)||60,
        notes: notes??null, action_items: items, updated_at: new Date().toISOString(),
      }).select().single()
      if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })
      // Auto-create tasks from action items
      if (items.length > 0) {
        await supabase.from('tasks').insert(items.map((item: string) => ({
          user_id: user.id, tenant_id: profile?.tenant_id,
          title: item, domain: 'academic', priority: 'medium', status: 'todo',
          source: 'meeting_notes', updated_at: new Date().toISOString(),
        })))
      }
      return NextResponse.json({ session: data }, { status: 201 })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal server error' }, { status: 500 })
  }
}

// ── PATCH ──────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { entity, id, ...updates } = await req.json()
    if (!id || !entity) return NextResponse.json({ error: 'id and entity required' }, { status: 400 })
    const safe: Record<string,unknown> = { updated_at: new Date().toISOString() }

    if (entity === 'chapter') {
      for (const k of ['title','chapter_num','status','word_count','target_words','notes','content','ai_summary']) { if (k in updates) safe[k] = updates[k] }
      if (safe.status && !CHAPTER_STATUSES.includes(safe.status)) return NextResponse.json({ error: 'invalid status' }, { status: 400 })
      if (safe.word_count !== undefined)   safe.word_count   = parseInt(safe.word_count)   || 0
      if (safe.target_words !== undefined) safe.target_words = parseInt(safe.target_words) || 8000
      const { data, error } = await supabase.from('thesis_chapters').update(safe).eq('id',id).eq('user_id',user.id).select().single()
      if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })
      return NextResponse.json({ chapter: data })
    }

    if (entity === 'module') {
      for (const k of ['title','module_type','status','deadline','credits','sort_order','grade','notes']) { if (k in updates) safe[k] = updates[k] }
      if (safe.status      && !MODULE_STATUSES.includes(safe.status))  return NextResponse.json({ error: 'invalid status' }, { status: 400 })
      if (safe.module_type && !MODULE_TYPES.includes(safe.module_type)) return NextResponse.json({ error: 'invalid module_type' }, { status: 400 })
      const { data, error } = await supabase.from('academic_modules').update(safe).eq('id',id).eq('user_id',user.id).select().single()
      if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })
      return NextResponse.json({ module: data })
    }

    if (entity === 'session') {
      for (const k of ['supervisor','session_date','session_type','format','duration_mins','notes','action_items','agenda','next_session','ai_summary']) { if (k in updates) safe[k] = updates[k] }
      if (safe.session_type && !SESSION_TYPES.includes(safe.session_type)) return NextResponse.json({ error: 'invalid session_type' }, { status: 400 })
      const { data, error } = await supabase.from('supervision_sessions').update(safe).eq('id',id).eq('user_id',user.id).select().single()
      if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })
      return NextResponse.json({ session: data })
    }

    return NextResponse.json({ error: `Unknown entity: ${entity}` }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE ──────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const entity = req.nextUrl.searchParams.get('entity')
    const id     = req.nextUrl.searchParams.get('id')
    if (!id || !entity) return NextResponse.json({ error: 'id and entity required' }, { status: 400 })
    const table = entity==='chapter'?'thesis_chapters':entity==='module'?'academic_modules':entity==='session'?'supervision_sessions':null
    if (!table) return NextResponse.json({ error: 'invalid entity' }, { status: 400 })
    const { error } = await supabase.fromtable.delete().eq('id',id).eq('user_id',user.id)
    if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })
    return NextResponse.json({ deleted: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal server error' }, { status: 500 })
  }
}
