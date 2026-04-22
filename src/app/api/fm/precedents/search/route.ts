import { NextRequest } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireFmAccess, cleanStringArray } from '@/app/api/fm/_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireFmAccess(req)
    if ('error' in auth) return auth.error

    const { admin, user } = auth
    const params = req.nextUrl.searchParams

    const query = String(params.get('query') ?? '').trim()
    const engagementType = params.get('engagement_type')
    const sector = params.get('industry_sector')
    const scale = params.get('project_scale')
    const tags = cleanStringArray((params.get('tags') ?? '').split(',').map((x) => x.trim()).filter(Boolean))
    const limit = Math.max(1, Math.min(Number(params.get('limit') ?? 30), 100))

    const { data: profile } = await admin.from('user_profiles').select('tenant_id').eq('id', user.id).maybeSingle()
    if (!profile?.tenant_id) return Response.json({ precedents: [] })

    let q = admin
      .from('fm_precedents')
      .select('*')
      .or(`tenant_id.eq.${profile.tenant_id},is_public.eq.true`)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (engagementType) q = q.eq('engagement_type', engagementType)
    if (sector) q = q.eq('industry_sector', sector)
    if (scale) q = q.eq('project_scale', scale)
    if (tags.length) q = q.overlaps('tags', tags)
    if (query) q = q.or(`title.ilike.%${query}%,anonymized_excerpt.ilike.%${query}%`)

    const { data, error } = await q
    if (error) throw error

    const terms = query
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((term) => term.length >= 3)

    const ranked = (data ?? []).map((item: any) => {
      const hay = `${item.title} ${item.anonymized_excerpt ?? ''} ${(item.tags ?? []).join(' ')}`.toLowerCase()
      const score = terms.length
        ? terms.reduce((acc, term) => acc + (hay.includes(term) ? 1 : 0), 0) / terms.length
        : 0.5
      return {
        ...item,
        similarity_score: Number(score.toFixed(3)),
      }
    })

    ranked.sort((a, b) => b.similarity_score - a.similarity_score || (a.title > b.title ? 1 : -1))

    return Response.json({ precedents: ranked })
  } catch (err: unknown) {
    return apiError(err)
  }
}
