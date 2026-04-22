import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireOwnedEngagement } from '@/app/api/fm/_shared'
import { buildReportData } from '@/lib/reports/report-data-model'
import { generatePDF } from '@/lib/reports/pdf-generator'
import { generatePPTX } from '@/lib/reports/pptx-generator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string }
type ReportFormat = 'json' | 'html' | 'pdf' | 'pptx'

function asHtml(data: Awaited<ReturnType<typeof buildReportData>>) {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>${data.engagement.title}</title></head>
  <body style="font-family: Inter, Arial, sans-serif; margin: 28px; color: #101828;">
    <h1 style="color:#1F4788;margin-bottom:4px;">${data.engagement.title}</h1>
    <div style="color:#667085; margin-bottom:16px;">Client: ${data.engagement.client_name} · Type: ${data.engagement.type} · Start: ${data.engagement.start_date}</div>
    <h2>Executive Summary</h2>
    <p>${data.executive_summary}</p>
    <h2>Objectives</h2>
    <ul>${data.engagement.objectives.map((objective) => `<li>${objective}</li>`).join('')}</ul>
    <h2>Top Risks</h2>
    <ul>${data.risks.slice(0, 12).map((risk) => `<li>${risk.code}: ${risk.title} (P:${risk.probability}, I:${risk.impact}, Score:${risk.score})</li>`).join('')}</ul>
    <h2>Options</h2>
    <ul>${data.options.map((option) => `<li><strong>${option.title}</strong> — ${option.cost_range} ${option.recommended ? '(recommended)' : ''}</li>`).join('')}</ul>
    <h2>Recommendations</h2>
    <p>${data.recommendations}</p>
  </body>
</html>`
}

export async function POST(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { id } = await context.params
    const auth = await requireOwnedEngagement(req, id)
    if ('error' in auth) return auth.error

    const { admin, engagement } = auth
    const body = (await req.json().catch(() => ({}))) as { format?: ReportFormat }
    const queryFormat = req.nextUrl.searchParams.get('format')
    const format = String(body.format ?? queryFormat ?? 'html').toLowerCase() as ReportFormat

    if (!['json', 'html', 'pdf', 'pptx'].includes(format)) {
      return NextResponse.json({ error: 'format must be one of json|html|pdf|pptx' }, { status: 400 })
    }

    const reportData = await buildReportData(id)

    let deliverableType: 'json' | 'html' | 'pdf' | 'pptx' = format
    let payload = ''
    let mimeType = 'application/json'
    let encoding: 'utf8' | 'base64' = 'utf8'
    let extension = format

    if (format === 'json') {
      payload = JSON.stringify(reportData, null, 2)
      mimeType = 'application/json'
      extension = 'json'
    } else if (format === 'html') {
      payload = asHtml(reportData)
      mimeType = 'text/html; charset=utf-8'
      extension = 'html'
    } else if (format === 'pdf') {
      const pdfBuffer = await generatePDF(reportData)
      payload = pdfBuffer.toString('base64')
      mimeType = 'application/pdf'
      encoding = 'base64'
      extension = 'pdf'
    } else {
      const pptxBuffer = await generatePPTX(reportData)
      payload = pptxBuffer.toString('base64')
      mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      encoding = 'base64'
      extension = 'pptx'
      deliverableType = 'pptx'
    }

    const { data: deliverable, error } = await admin
      .from('engagement_deliverables')
      .insert({
        engagement_id: id,
        deliverable_type: deliverableType,
        title: `${engagement.title} report (${format.toUpperCase()})`,
        content: payload,
        metadata: {
          generated_from: 'fm_report_pipeline',
          format,
          mime_type: mimeType,
          encoding,
          filename: `${engagement.title.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase() || 'engagement-report'}.${extension}`,
        },
      })
      .select('id,title,deliverable_type,metadata,created_at')
      .single()

    if (error) throw error

    const reportUrl = `/api/engagements/${id}/report/download?deliverable_id=${deliverable.id}`

    return NextResponse.json({
      report: deliverable,
      report_url: reportUrl,
      download_url: reportUrl,
      report_data: format === 'json' ? reportData : undefined,
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}
