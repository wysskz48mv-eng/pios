import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireCitationGraphAccess } from '@/app/api/citation-graph/_shared'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireCitationGraphAccess(req)
    if ('error' in auth) return auth.error

    const { admin, user } = auth

    const { data, error } = await admin
      .from('pios_research_landscapes')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ landscapes: data ?? [] })
  } catch (err) {
    return apiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCitationGraphAccess(req)
    if ('error' in auth) return auth.error

    const { admin, user, tenantId } = auth
    const body = await req.json() as {
      name?: string
      description?: string
      topic_keywords?: string[]
      refresh_frequency?: 'daily' | 'weekly' | 'monthly'
    }

    const name = String(body.name ?? '').trim()
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const { data, error } = await admin
      .from('pios_research_landscapes')
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        name,
        description: body.description ?? null,
        topic_keywords: Array.isArray(body.topic_keywords) ? body.topic_keywords : [],
        refresh_frequency: body.refresh_frequency ?? 'weekly',
      })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ landscape: data })
  } catch (err) {
    return apiError(err)
  }
}
