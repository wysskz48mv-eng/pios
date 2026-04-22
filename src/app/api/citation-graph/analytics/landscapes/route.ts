import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireCitationGraphAccess } from '@/app/api/citation-graph/_shared'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireCitationGraphAccess(req)
    if ('error' in auth) return auth.error

    const { admin } = auth
    const keywords = req.nextUrl.searchParams.getAll('keywords[]')
      .concat(req.nextUrl.searchParams.get('keywords')?.split(',').map((k) => k.trim()).filter(Boolean) ?? [])

    if (!keywords.length) {
      return NextResponse.json({ error: 'keywords[] is required' }, { status: 400 })
    }

    const clauses = keywords.map((keyword) => `title.ilike.%${keyword}%`).join(',')
    const { data: papers, error } = await admin
      .from('pios_papers')
      .select('id,title,publication_year,citation_count,venue,data_source')
      .or(clauses)
      .order('citation_count', { ascending: false })
      .limit(300)

    if (error) throw error

    const clusterMap = new Map<string, Array<Record<string, unknown>>>()

    for (const paper of papers ?? []) {
      const key = String(paper.data_source ?? 'unknown')
      if (!clusterMap.has(key)) clusterMap.set(key, [])
      clusterMap.get(key)!.push(paper as Record<string, unknown>)
    }

    const clusters = [...clusterMap.entries()].map(([clusterKey, items]) => ({
      cluster_key: clusterKey,
      paper_count: items.length,
      papers: items.slice(0, 50),
    }))

    return NextResponse.json({
      keywords,
      total_papers: papers?.length ?? 0,
      clusters,
    })
  } catch (err) {
    return apiError(err)
  }
}
