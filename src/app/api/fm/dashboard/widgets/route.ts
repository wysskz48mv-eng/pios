import { NextRequest } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireFmAccess } from '@/app/api/fm/_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireFmAccess(req)
    if ('error' in auth) return auth.error

    const { admin, user } = auth

    const [{ data: engagements }, { data: risks }, { data: fmTypes }] = await Promise.all([
      admin
        .from('consulting_engagements')
        .select('id,status,fm_engagement_type_code')
        .eq('user_id', user.id)
        .not('fm_engagement_type_code', 'is', null)
        .neq('status', 'archived'),
      admin
        .from('engagement_risks')
        .select('engagement_id,probability,impact,risk_score,risk_library:fm_risk_library(title,iso_references)')
        .eq('user_id', user.id),
      admin.from('fm_engagement_types').select('type_code,name,iso_standards').eq('is_active', true),
    ])

    const fmByTypeMap = new Map<string, number>()
    for (const engagement of engagements ?? []) {
      const key = engagement.fm_engagement_type_code ?? 'unknown'
      fmByTypeMap.set(key, (fmByTypeMap.get(key) ?? 0) + 1)
    }

    const activeByType = Array.from(fmByTypeMap.entries()).map(([typeCode, count]) => ({
      type_code: typeCode,
      name: fmTypes?.find((item) => item.type_code === typeCode)?.name ?? typeCode,
      count,
    }))

    const heatmap = [
      { probability: 'low', impact: 'low', count: 0 },
      { probability: 'low', impact: 'medium', count: 0 },
      { probability: 'low', impact: 'high', count: 0 },
      { probability: 'medium', impact: 'low', count: 0 },
      { probability: 'medium', impact: 'medium', count: 0 },
      { probability: 'medium', impact: 'high', count: 0 },
      { probability: 'high', impact: 'low', count: 0 },
      { probability: 'high', impact: 'medium', count: 0 },
      { probability: 'high', impact: 'high', count: 0 },
    ]

    for (const risk of risks ?? []) {
      const item = heatmap.find((cell) => cell.probability === risk.probability && cell.impact === risk.impact)
      if (item) item.count += 1
    }

    const riskCountMap = new Map<string, number>()
    for (const risk of risks ?? []) {
      const library = Array.isArray(risk.risk_library) ? risk.risk_library[0] : risk.risk_library
      const title = library?.title ?? 'Custom risk'
      riskCountMap.set(title, (riskCountMap.get(title) ?? 0) + 1)
    }

    const topRisks = Array.from(riskCountMap.entries())
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    const typeIsoMap = new Map((fmTypes ?? []).map((item) => [item.type_code, item.iso_standards ?? []]))
    let compliant = 0

    for (const engagement of engagements ?? []) {
      const requiredIso = typeIsoMap.get(engagement.fm_engagement_type_code ?? '') ?? []
      if (!requiredIso.length) {
        compliant += 1
        continue
      }

      const engagementRisks = (risks ?? []).filter((risk) => risk.engagement_id === engagement.id)
      const seen = new Set<string>()
      engagementRisks.forEach((risk) => {
        const library = Array.isArray(risk.risk_library) ? risk.risk_library[0] : risk.risk_library
        ;(library?.iso_references ?? []).forEach((iso: string) => seen.add(iso))
      })

      const covered = requiredIso.every((iso: string) => seen.has(iso))
      if (covered) compliant += 1
    }

    const total = (engagements ?? []).length
    const compliancePercent = total > 0 ? Math.round((compliant / total) * 100) : 100

    return Response.json({
      risk_heatmap: heatmap,
      active_fm_engagements_by_type: activeByType,
      compliance_status_percent: compliancePercent,
      top_risks_across_portfolio: topRisks,
      totals: {
        active_engagements: total,
        risks: (risks ?? []).length,
      },
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}
