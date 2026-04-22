import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireFmAccess, cleanStringArray } from '@/app/api/fm/_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function anonymize(input: string, clientName?: string | null) {
  let output = input
  if (clientName) {
    const esc = clientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    output = output.replace(new RegExp(esc, 'gi'), '[CLIENT]')
  }
  // Light anonymisation for common direct identifiers.
  output = output.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]')
  output = output.replace(/\+?\d[\d\s().-]{7,}\d/g, '[PHONE]')
  return output
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireFmAccess(req)
    if ('error' in auth) return auth.error

    const { admin, user } = auth
    const body = (await req.json()) as {
      engagement_id?: string
      title?: string
      engagement_type?: string
      industry_sector?: string
      building_type?: string
      project_scale?: string
      anonymized_excerpt?: string
      tags?: string[]
      frameworks_used?: string[]
      reusable_artifacts?: Record<string, unknown>
      is_public?: boolean
    }

    let sourceEngagement: Record<string, any> | null = null
    if (body.engagement_id) {
      const { data, error } = await admin
        .from('consulting_engagements')
        .select('*')
        .eq('id', body.engagement_id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      sourceEngagement = data
      if (!sourceEngagement) {
        return NextResponse.json({ error: 'Source engagement not found' }, { status: 404 })
      }
    }

    const frameworkCodes = body.frameworks_used ?? []
    let reusableArtifacts = body.reusable_artifacts ?? {}

    if (body.engagement_id && frameworkCodes.length === 0) {
      const { data: runs } = await admin
        .from('engagement_frameworks')
        .select('framework_code,step_number,output')
        .eq('engagement_id', body.engagement_id)
      reusableArtifacts = {
        ...reusableArtifacts,
        framework_runs: runs ?? [],
      }
    }

    const excerpt = body.anonymized_excerpt
      ? body.anonymized_excerpt
      : sourceEngagement
        ? String(sourceEngagement.brief ?? sourceEngagement.ai_output ?? '').slice(0, 2200)
        : ''

    const payload = {
      user_id: user.id,
      title: String(body.title ?? sourceEngagement?.title ?? 'Untitled precedent').trim(),
      engagement_type: String(body.engagement_type ?? sourceEngagement?.fm_engagement_type_code ?? sourceEngagement?.engagement_type ?? 'fm_type_1'),
      industry_sector: body.industry_sector ?? sourceEngagement?.industry_sector ?? null,
      building_type: body.building_type ?? sourceEngagement?.building_type ?? null,
      project_scale: body.project_scale ?? sourceEngagement?.project_scale ?? null,
      anonymized_excerpt: anonymize(excerpt, sourceEngagement?.client_name),
      tags: cleanStringArray(body.tags),
      frameworks_used: cleanStringArray(body.frameworks_used),
      reusable_artifacts: reusableArtifacts,
      original_engagement_id: body.engagement_id ?? null,
      created_from_engagement_at: body.engagement_id ? new Date().toISOString() : null,
      is_public: body.is_public === true,
    }

    const { data, error } = await admin
      .from('fm_precedents')
      .insert(payload)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ precedent: data }, { status: 201 })
  } catch (err: unknown) {
    return apiError(err)
  }
}
