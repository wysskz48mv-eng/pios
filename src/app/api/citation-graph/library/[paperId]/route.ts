import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireCitationGraphAccess } from '@/app/api/citation-graph/_shared'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, context: { params: Promise<{ paperId: string }> }) {
  try {
    const auth = await requireCitationGraphAccess(req)
    if ('error' in auth) return auth.error

    const { admin, user, tenantId } = auth
    const { paperId } = await context.params
    const body = await req.json().catch(() => ({})) as { tags?: string[]; notes?: string; reading_status?: string }

    const { data, error } = await admin
      .from('pios_paper_enrichment')
      .upsert({
        tenant_id: tenantId,
        user_id: user.id,
        paper_id: paperId,
        tags: Array.isArray(body.tags) ? body.tags : [],
        notes: body.notes ?? null,
        reading_status: body.reading_status ?? 'to_read',
        last_accessed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,paper_id' })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ item: data })
  } catch (err) {
    return apiError(err)
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ paperId: string }> }) {
  try {
    const auth = await requireCitationGraphAccess(req)
    if ('error' in auth) return auth.error

    const { admin, user } = auth
    const { paperId } = await context.params
    const body = await req.json().catch(() => ({})) as { tags?: string[]; notes?: string; reading_status?: string; highlights?: unknown[] }

    const payload: Record<string, unknown> = {
      last_accessed_at: new Date().toISOString(),
    }

    if (Array.isArray(body.tags)) payload.tags = body.tags
    if (typeof body.notes === 'string') payload.notes = body.notes
    if (typeof body.reading_status === 'string') payload.reading_status = body.reading_status
    if (Array.isArray(body.highlights)) payload.highlights = body.highlights

    const { data, error } = await admin
      .from('pios_paper_enrichment')
      .update(payload)
      .eq('user_id', user.id)
      .eq('paper_id', paperId)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ item: data })
  } catch (err) {
    return apiError(err)
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ paperId: string }> }) {
  try {
    const auth = await requireCitationGraphAccess(req)
    if ('error' in auth) return auth.error

    const { admin, user } = auth
    const { paperId } = await context.params

    const { error } = await admin
      .from('pios_paper_enrichment')
      .delete()
      .eq('user_id', user.id)
      .eq('paper_id', paperId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError(err)
  }
}
