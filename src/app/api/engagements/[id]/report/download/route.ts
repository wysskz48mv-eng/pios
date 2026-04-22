import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireOwnedEngagement } from '@/app/api/fm/_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string }

export async function GET(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { id } = await context.params
    const auth = await requireOwnedEngagement(req, id)
    if ('error' in auth) return auth.error

    const { admin } = auth
    const deliverableId = String(req.nextUrl.searchParams.get('deliverable_id') ?? '').trim()
    if (!deliverableId) {
      return NextResponse.json({ error: 'deliverable_id is required' }, { status: 400 })
    }

    const { data: deliverable, error } = await admin
      .from('engagement_deliverables')
      .select('*')
      .eq('id', deliverableId)
      .eq('engagement_id', id)
      .maybeSingle()

    if (error) throw error
    if (!deliverable) return NextResponse.json({ error: 'Report deliverable not found' }, { status: 404 })

    const metadata = (deliverable.metadata ?? {}) as Record<string, unknown>
    const mimeType = String(metadata.mime_type ?? 'text/plain; charset=utf-8')
    const encoding = String(metadata.encoding ?? 'utf8')
    const fileName = String(metadata.filename ?? `${deliverable.title ?? 'report'}.txt`)

    const body = encoding === 'base64'
      ? Buffer.from(String(deliverable.content ?? ''), 'base64')
      : Buffer.from(String(deliverable.content ?? ''), 'utf8')

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}
