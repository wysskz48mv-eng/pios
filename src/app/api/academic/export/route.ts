/**
 * POST /api/academic/export
 * Exports thesis chapters as formatted Markdown (copy to Word / Notion / Obsidian).
 * Supports single chapter or full thesis export.
 * PIOS v3.0 | Sprint 24
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  const { chapter_id, format = 'markdown' } = body  // format: 'markdown' | 'plain'

  // Fetch chapters
  let q = supabase
    .from('thesis_chapters')
    .select('id,chapter_num,title,status,word_count,content,ai_feedback,updated_at')
    .eq('user_id', user.id)
    .order('chapter_num')

  if (chapter_id) q = (q as any).eq('id', chapter_id)

  const { data: chapters, error } = await q
  if (error) return NextResponse.json({ error: (error as Error).message }, { status: 500 })

  // Fetch user profile for thesis title
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name,programme_title,institution,supervisor_name')
    .eq('user_id', user.id)
    .single()

  const now       = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const thesisTitle = profile?.programme_title ?? 'Doctoral Thesis'
  const authorName  = profile?.full_name ?? 'Author'
  const institution = profile?.institution ?? ''
  const supervisor  = profile?.supervisor_name ?? ''

  const statusLabel: Record<string, string> = {
    not_started:    'Not started',
    outline:        'Outline',
    drafting:       'Drafting',
    draft_complete: 'Draft complete',
    submitted:      'Submitted',
    passed:         'Passed',
    failed:         'Failed',
  }

  const lines: string[] = []

  // Cover block
  if (!chapter_id) {
    lines.push(`# ${thesisTitle}`, '')
    if (authorName) lines.push(`**Author:** ${authorName}`)
    if (institution) lines.push(`**Institution:** ${institution}`)
    if (supervisor) lines.push(`**Supervisor:** ${supervisor}`)
    lines.push(`**Exported:** ${now}`, '', '---', '')
    lines.push('## Table of Contents', '')
    for (const ch of (chapters ?? [])) {
      const wc = ch.word_count ? ` *(${Number(ch.word_count).toLocaleString()} words)*` : ''
      lines.push(`${ch.chapter_num}. ${ch.title ?? `Chapter ${ch.chapter_num}`}${wc}`)
    }
    lines.push('', '---', '')
  }

  // Chapter content
  for (const ch of (chapters ?? [])) {
    const heading  = ch.title ?? `Chapter ${ch.chapter_num}`
    const wc       = ch.word_count ? `${Number(ch.word_count).toLocaleString()} words` : ''
    const status   = statusLabel[ch.status] ?? ch.status
    const updated  = ch.updated_at ? new Date(ch.updated_at).toLocaleDateString('en-GB') : ''

    lines.push(`## Chapter ${ch.chapter_num}: ${heading}`, '')
    lines.push(`> **Status:** ${status}${wc ? ` · ${wc}` : ''}${updated ? ` · Updated ${updated}` : ''}`, '')

    if (ch.content) {
      lines.push(ch.content, '')
    } else {
      lines.push('*[No content yet — chapter in progress]*', '')
    }

    if (ch.ai_feedback) {
      lines.push('### Supervisor AI Feedback', '')
      lines.push(`> ${String(ch.ai_feedback).replace(/\n/g, '\n> ')}`, '')
    }

    lines.push('---', '')
  }

  const markdown = lines.join('\n')
  const totalWords = (chapters ?? []).reduce((s, c) => s + (Number(c.word_count) || 0), 0)
  const filename = chapter_id
    ? `chapter_${(chapters ?? [])[0]?.chapter_num ?? '1'}_${now.replace(/ /g, '_')}.md`
    : `${thesisTitle.replace(/[^a-z0-9]/gi, '_').slice(0, 40)}_${now.replace(/ /g, '_')}.md`

  return new NextResponse(markdown, {
    headers: {
      'Content-Type':        'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Word-Count':        String(totalWords),
      'X-Chapter-Count':     String((chapters ?? []).length),
    },
  })
}
