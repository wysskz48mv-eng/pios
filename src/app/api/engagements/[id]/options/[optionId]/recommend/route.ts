import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireOwnedEngagement } from '@/app/api/fm/_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string; optionId: string }

export async function POST(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { id, optionId } = await context.params
    const auth = await requireOwnedEngagement(req, id)
    if ('error' in auth) return auth.error

    const { admin } = auth
    const body = (await req.json().catch(() => ({}))) as { reasoning?: string }

    const { data: option, error: readErr } = await admin
      .from('fm_options')
      .select('*')
      .eq('id', optionId)
      .eq('engagement_id', id)
      .maybeSingle()

    if (readErr) throw readErr
    if (!option) return NextResponse.json({ error: 'Option not found' }, { status: 404 })

    await admin.from('fm_options').update({ is_recommended: false }).eq('engagement_id', id)

    const { data, error } = await admin
      .from('fm_options')
      .update({
        is_recommended: true,
        recommendation_reasoning: body.reasoning ? String(body.reasoning) : option.recommendation_reasoning,
      })
      .eq('id', optionId)
      .eq('engagement_id', id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ option: data, recommended_option_id: optionId })
  } catch (err: unknown) {
    return apiError(err)
  }
}
