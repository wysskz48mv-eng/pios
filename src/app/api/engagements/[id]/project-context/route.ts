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

    const { admin, engagement, user } = auth

    if (!engagement.project_id) {
      return NextResponse.json({
        project: null,
        documents: [],
        intelligence: null,
      })
    }

    const [{ data: project }, { data: documents }, { data: intelligence }, { data: risks }] = await Promise.all([
      admin.from('projects').select('*').eq('id', engagement.project_id).eq('user_id', user.id).maybeSingle(),
      admin
        .from('project_source_documents')
        .select('id,filename,file_type,uploaded_at')
        .eq('project_id', engagement.project_id)
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false })
        .limit(50),
      admin
        .from('project_intelligence')
        .select('id,budget_total,budget_currency,description,scope,deliverables,success_criteria,risks,compliance_frameworks,created_at')
        .eq('project_id', engagement.project_id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('engagement_risks')
        .select('id,custom_title,linked_email_ids,notes')
        .eq('engagement_id', id),
    ])

    return NextResponse.json({
      project: project ?? null,
      documents: documents ?? [],
      intelligence: intelligence ?? null,
      risk_evidence_links: risks ?? [],
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}
