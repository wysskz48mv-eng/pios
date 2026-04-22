import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireCitationGraphAccess } from '@/app/api/citation-graph/_shared'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCitationGraphAccess(req)
    if ('error' in auth) return auth.error

    const { admin, user } = auth
    const { id } = await context.params
    const body = await req.json() as {
      name?: string
      description?: string
      topic_keywords?: string[]
      refresh_frequency?: 'daily' | 'weekly' | 'monthly'
    }

    const payload: Record<string, unknown> = {}
    if (typeof body.name === 'string') payload.name = body.name.trim()
    if (typeof body.description === 'string') payload.description = body.description
    if (Array.isArray(body.topic_keywords)) payload.topic_keywords = body.topic_keywords
    if (body.refresh_frequency) payload.refresh_frequency = body.refresh_frequency

    const { data, error } = await admin
      .from('pios_research_landscapes')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ landscape: data })
  } catch (err) {
    return apiError(err)
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCitationGraphAccess(req)
    if ('error' in auth) return auth.error

    const { admin, user } = auth
    const { id } = await context.params

    const { error } = await admin
      .from('pios_research_landscapes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError(err)
  }
}
