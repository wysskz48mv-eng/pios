import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

export const runtime = 'nodejs'
export const maxDuration = 30

// ─────────────────────────────────────────────────────────────────────────────
// /api/research/journals
// GET  — list watchlist journals
// POST { action: 'add', journal } — add to watchlist
// POST { action: 'update_status', id, status, notes } — update submission status
// POST { action: 'get_guidelines', journalName, guidelinesUrl } — AI summary of author guidelines
// POST { action: 'delete', id } — remove from watchlist
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase.from('journal_watchlist')
      .select('*')
      .eq('user_id', user.id)
      .order('priority', { ascending: false })

    return NextResponse.json({ journals: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { action } = body

    if (action === 'add') {
      const { journal } = body
      if (!journal?.journal_name) return NextResponse.json({ error: 'Journal name required' }, { status: 400 })
      const { data } = await supabase.from('journal_watchlist').insert({
        user_id: user.id,
        ...journal,
      }).select('id').single()
      return NextResponse.json({ added: true, id: data?.id })
    }

    if (action === 'update_status') {
      const { id, status, submission_date, decision_date, notes } = body
      await supabase.from('journal_watchlist').update({
        status,
        submission_date: submission_date || null,
        decision_date: decision_date || null,
        notes,
        updated_at: new Date().toISOString(),
      }).eq('id', id).eq('user_id', user.id)
      return NextResponse.json({ updated: true })
    }

    if (action === 'delete') {
      await supabase.from('journal_watchlist').delete().eq('id', body.id).eq('user_id', user.id)
      return NextResponse.json({ deleted: true })
    }

    if (action === 'get_guidelines') {
      const { journalName, guidelinesUrl, publisher } = body
      if (!journalName) return NextResponse.json({ error: 'Journal name required' }, { status: 400 })

      const system = `You are an academic publishing consultant helping a DBA researcher prepare manuscripts for submission. Provide a structured, accurate author guidelines summary based on your knowledge of the journal.

Return ONLY valid JSON:
{
  "word_limit": 8000,
  "structured_abstract": true,
  "abstract_words": 250,
  "sections_required": ["Introduction", "Literature Review", "Methodology", "Findings", "Discussion", "Conclusion"],
  "reference_style": "APA 7th / Harvard / Vancouver / etc",
  "blind_review": "double_blind",
  "submission_system": "ScholarOne / Editorial Manager / direct email / etc",
  "key_requirements": ["Bullet list of key requirements DBA researcher must know"],
  "common_rejection_reasons": ["Most common reasons papers are rejected at this journal"],
  "fit_assessment": "2-3 sentences: how well Douglas's DBA research on AI-FM in GCC aligns with this journal's scope and recent publications",
  "submission_checklist": ["Actionable checklist items to complete before submission"],
  "typical_timeline": "Estimated weeks from submission to first decision",
  "open_access_option": "Description of OA options and costs if any",
  "notes": "Any other important notes for this specific journal"
}`

      const raw = await callClaude(
        [{ role: 'user', content: `Provide complete author guidelines summary for: ${journalName} (${publisher ?? 'publisher unknown'}). Guidelines URL: ${guidelinesUrl ?? 'not provided'}. Context: DBA researcher submitting on AI-enabled FM forecasting in GCC contexts with STS/sensemaking theoretical framework.` }],
        system,
        1500
      )

      let guidelines: any = {}
      try {
        const clean = raw.replace(/```json|```/g, '').trim()
        guidelines = JSON.parse(clean)
      } catch {
        return NextResponse.json({ error: 'Guidelines parsing failed' }, { status: 500 })
      }

      // Update DB with word limit if we have it
      if (guidelines.word_limit && body.id) {
        await supabase.from('journal_watchlist').update({
          word_limit: guidelines.word_limit,
          review_process: guidelines.blind_review?.includes('double') ? 'double_blind' : 'single_blind',
          updated_at: new Date().toISOString(),
        }).eq('id', body.id).eq('user_id', user.id)
      }

      return NextResponse.json({
        guidelines,
        journalName,
        disclaimer: 'AI-generated guidelines summary. Always verify against the official author guidelines page before submitting.',
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    console.error('/api/research/journals:', err)
    return NextResponse.json({ error: err.message ?? 'Request failed' }, { status: 500 })
  }
}
