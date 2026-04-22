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

    const { data, error } = await admin
      .from('engagement_stakeholders')
      .select('*, stakeholder:stakeholders(id,name,role,organisation,influence,alignment,engagement,next_touchpoint)')
      .eq('engagement_id', id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ stakeholders: data ?? [] })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function POST(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { id } = await context.params
    const auth = await requireOwnedEngagement(req, id)
    if ('error' in auth) return auth.error

    const { admin, user } = auth
    const body = (await req.json()) as {
      stakeholder_id?: string
      engagement_role?: string
    }

    const stakeholderId = String(body.stakeholder_id ?? '').trim()
    const engagementRole = String(body.engagement_role ?? '').trim()

    if (!stakeholderId || !engagementRole) {
      return NextResponse.json({ error: 'stakeholder_id and engagement_role are required' }, { status: 400 })
    }

    const { data: stakeholder, error: stakeholderError } = await admin
      .from('stakeholders')
      .select('id,user_id')
      .eq('id', stakeholderId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (stakeholderError) throw stakeholderError
    if (!stakeholder) return NextResponse.json({ error: 'Stakeholder not found' }, { status: 404 })

    const { data, error } = await admin
      .from('engagement_stakeholders')
      .upsert(
        {
          user_id: user.id,
          engagement_id: id,
          stakeholder_id: stakeholderId,
          engagement_role: engagementRole,
        },
        { onConflict: 'engagement_id,stakeholder_id' }
      )
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ stakeholder_link: data }, { status: 201 })
  } catch (err: unknown) {
    return apiError(err)
  }
}
