/**
 * GET /api/files/list — flat list of file_items for Document Intelligence page
 * PIOS v2.2 | VeritasIQ Technologies Ltd
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
    const query = searchParams.get('q') ?? ''

    let q = supabase
      .from('file_items')
      .select(`
        id, name, file_type, file_size_bytes, ai_summary, ai_tags,
        filing_status, created_at, space_id,
        file_spaces(name)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (query) q = q.ilike('name', `%${query}%`)

    const { data, error } = await q
    if (error) throw error

    const files = (data ?? []).map(item => {
      const row = item as Record<string, unknown>
      const space = row.file_spaces as Record<string, unknown> | null
      const sizeBytes = Number(row.file_size_bytes ?? 0)
      return {
        id:         String(row.id ?? ''),
        name:       String(row.name ?? ''),
        file_type:  String(row.file_type ?? 'file'),
        size_kb:    Math.round(sizeBytes / 1024),
        summary:    row.ai_summary ? String(row.ai_summary) : undefined,
        tags:       Array.isArray(row.ai_tags) ? row.ai_tags as string[] : undefined,
        status:     String(row.filing_status ?? 'unfiled'),
        created_at: String(row.created_at ?? ''),
        space_name: space ? String(space.name ?? '') : undefined,
      }
    })

    return NextResponse.json({ ok: true, files, total: files.length })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg, files: [] }, { status: 500 })
  }
}
