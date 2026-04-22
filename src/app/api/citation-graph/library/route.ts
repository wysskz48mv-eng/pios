import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireCitationGraphAccess } from '@/app/api/citation-graph/_shared'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireCitationGraphAccess(req)
    if ('error' in auth) return auth.error

    const { admin, user } = auth
    const status = req.nextUrl.searchParams.get('status')?.trim()

    let query = admin
      .from('pios_paper_enrichment')
      .select('id,tags,notes,highlights,reading_status,added_to_library_at,last_accessed_at,pios_papers(*)')
      .eq('user_id', user.id)
      .order('added_to_library_at', { ascending: false })

    if (status) query = query.eq('reading_status', status)

    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []).map((item) => ({
      id: item.id,
      paper: item.pios_papers,
      tags: item.tags ?? [],
      notes: item.notes ?? null,
      highlights: item.highlights ?? [],
      reading_status: item.reading_status ?? null,
      added_to_library_at: item.added_to_library_at,
      last_accessed_at: item.last_accessed_at,
    }))

    return NextResponse.json({ library: rows })
  } catch (err) {
    return apiError(err)
  }
}
