import puppeteer from 'puppeteer'
import type { EngagementReportData } from '@/lib/reports/report-data-model'

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderHtml(data: EngagementReportData) {
  const steps = data.steps
    .map(
      (step) => `
      <section>
        <h3>Step ${step.step_number}: ${escapeHtml(step.step_name)}</h3>
        <p><strong>Confidence:</strong> ${escapeHtml(step.confidence)}</p>
        <ul>
          ${step.frameworks
            .map(
              (fw) => `<li><strong>${escapeHtml(fw.name)}</strong>: ${escapeHtml(JSON.stringify(fw.output).slice(0, 280))}</li>`
            )
            .join('')}
        </ul>
      </section>`
    )
    .join('')

  const risks = data.risks
    .slice(0, 12)
    .map(
      (risk) => `<tr>
        <td>${escapeHtml(risk.code)}</td>
        <td>${escapeHtml(risk.title)}</td>
        <td>${escapeHtml(risk.probability)}</td>
        <td>${escapeHtml(risk.impact)}</td>
        <td>${risk.score}</td>
      </tr>`
    )
    .join('')

  const options = data.options
    .map(
      (option) => `<tr>
        <td>${escapeHtml(option.title)}</td>
        <td>${escapeHtml(option.pros.slice(0, 3).join(' • '))}</td>
        <td>${escapeHtml(option.cons.slice(0, 3).join(' • '))}</td>
        <td>${escapeHtml(option.cost_range)}</td>
        <td>${option.recommended ? '✓' : ''}</td>
      </tr>`
    )
    .join('')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Inter, Arial, sans-serif; margin: 28px; color: #101828; }
      h1 { color: #1F4788; margin: 0 0 6px; }
      h2 { margin-top: 24px; border-bottom: 1px solid #e4e7ec; padding-bottom: 6px; }
      h3 { margin: 14px 0 6px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #d0d5dd; padding: 7px; text-align: left; vertical-align: top; }
      th { background: #f2f4f7; }
      .muted { color: #667085; }
      .box { border: 1px solid #eaecf0; background: #f9fafb; padding: 12px; border-radius: 8px; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(data.engagement.title)}</h1>
    <div class="muted">Client: ${escapeHtml(data.engagement.client_name)} · Type: ${escapeHtml(data.engagement.type)} · Start: ${escapeHtml(data.engagement.start_date)}</div>

    <h2>Executive Summary</h2>
    <div class="box">${escapeHtml(data.executive_summary)}</div>

    <h2>Engagement Objectives</h2>
    <ul>${data.engagement.objectives.map((objective) => `<li>${escapeHtml(objective)}</li>`).join('')}</ul>

    <h2>Step Outputs</h2>
    ${steps}

    <h2>Risk Register</h2>
    <table>
      <thead><tr><th>Code</th><th>Risk</th><th>Probability</th><th>Impact</th><th>Score</th></tr></thead>
      <tbody>${risks}</tbody>
    </table>

    <h2>Options Comparison</h2>
    <table>
      <thead><tr><th>Option</th><th>Pros</th><th>Cons</th><th>Cost</th><th>Recommended</th></tr></thead>
      <tbody>${options}</tbody>
    </table>

    <h2>Recommendations</h2>
    <div class="box">${escapeHtml(data.recommendations)}</div>
  </body>
</html>`
}

export async function generatePDF(data: EngagementReportData): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setContent(renderHtml(data), { waitUntil: 'networkidle0' })
    const buffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '14mm', right: '10mm', bottom: '14mm', left: '10mm' } })
    return Buffer.from(buffer)
  } finally {
    await browser.close()
  }
}
