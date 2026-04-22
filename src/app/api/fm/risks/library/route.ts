import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireFmAccess } from '@/app/api/fm/_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function tokenize(input: string) {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3)
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireFmAccess(req)
    if ('error' in auth) return auth.error

    const { admin } = auth
    const category = req.nextUrl.searchParams.get('category')
    const typeCode = req.nextUrl.searchParams.get('type')
    const query = req.nextUrl.searchParams.get('query')
    const suggestText = req.nextUrl.searchParams.get('suggest')
    const limit = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 100), 200))

    let q = admin
      .from('fm_risk_library')
      .select('*')
      .eq('is_active', true)
      .order('risk_code', { ascending: true })
      .limit(limit)

    if (category) q = q.eq('category', category)
    if (typeCode) q = q.contains('engagement_types', [typeCode])
    if (query) {
      const term = query.trim()
      q = q.or(`risk_code.ilike.%${term}%,title.ilike.%${term}%,description.ilike.%${term}%`)
    }

    const { data, error } = await q
    if (error) throw error

    const rows = data ?? []

    if (suggestText && suggestText.trim()) {
      const words = tokenize(suggestText)
      const scored = rows
        .map((row) => {
          const hay = `${row.risk_code} ${row.title} ${row.description} ${row.category}`.toLowerCase()
          const score = words.reduce((acc, word) => acc + (hay.includes(word) ? 1 : 0), 0)
          return { ...row, _score: score }
        })
        .filter((row) => row._score > 0)
        .sort((a, b) => b._score - a._score)
        .slice(0, 8)

      return NextResponse.json({
        risks: rows,
        suggested: scored,
      })
    }

    return NextResponse.json({ risks: rows })
  } catch (err: unknown) {
    return apiError(err)
  }
}
