import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireCitationGraphAccess } from '@/app/api/citation-graph/_shared'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireCitationGraphAccess(req)
    if ('error' in auth) return auth.error

    const { admin } = auth

    const nowYear = new Date().getFullYear()
    const baselineYear = nowYear - 2

    const { data: trends, error } = await admin
      .from('pios_research_trends')
      .select('topic,year,paper_count,citation_count,growth_rate')
      .gte('year', baselineYear)
      .lte('year', nowYear)
      .order('year', { ascending: true })

    if (error) throw error

    const grouped = new Map<string, Array<Record<string, unknown>>>()
    for (const row of trends ?? []) {
      const topic = String(row.topic ?? 'General Research')
      if (!grouped.has(topic)) grouped.set(topic, [])
      grouped.get(topic)!.push(row as Record<string, unknown>)
    }

    const emerging = [...grouped.entries()]
      .map(([topic, rows]) => {
        const first = Number(rows[0]?.paper_count ?? 0)
        const last = Number(rows[rows.length - 1]?.paper_count ?? 0)
        const growth = first > 0 ? ((last - first) / first) * 100 : (last > 0 ? 100 : 0)

        return {
          topic,
          growth_rate: Number(growth.toFixed(2)),
          papers_latest_year: last,
          citations_latest_year: Number(rows[rows.length - 1]?.citation_count ?? 0),
        }
      })
      .filter((row) => row.growth_rate >= 30 && row.papers_latest_year >= 3)
      .sort((a, b) => b.growth_rate - a.growth_rate)
      .slice(0, 15)

    return NextResponse.json({
      as_of_year: nowYear,
      emerging_topics: emerging,
    })
  } catch (err) {
    return apiError(err)
  }
}
