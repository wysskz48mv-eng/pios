import pptxgen from 'pptxgenjs'
import type { EngagementReportData } from '@/lib/reports/report-data-model'

function trimLine(value: string, max = 110) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 3)}...`
}

export async function generatePPTX(data: EngagementReportData): Promise<Buffer> {
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'PIOS'
  pptx.company = 'VeritasIQ Technologies Ltd'
  pptx.subject = 'FM Engagement Report'
  pptx.title = data.engagement.title

  const slide1 = pptx.addSlide()
  slide1.addText(data.engagement.title, {
    x: 0.8, y: 1.8, w: 11.2, h: 0.8,
    fontSize: 30, bold: true, color: '1F4788',
  })
  slide1.addText(`Client: ${data.engagement.client_name}`, { x: 0.8, y: 3.0, w: 8, h: 0.5, fontSize: 18 })
  slide1.addText(`Type: ${data.engagement.type} · Start: ${data.engagement.start_date}`, { x: 0.8, y: 3.6, w: 9, h: 0.5, fontSize: 13, color: '667085' })

  const slide2 = pptx.addSlide()
  slide2.addText('Executive Summary', { x: 0.5, y: 0.4, w: 12, h: 0.6, fontSize: 28, bold: true })
  slide2.addText(trimLine(data.executive_summary, 1400), {
    x: 0.6, y: 1.2, w: 12.0, h: 5.4, fontSize: 15, valign: 'top',
  })

  const slide3 = pptx.addSlide()
  slide3.addText('Engagement Objectives', { x: 0.5, y: 0.4, w: 12, h: 0.6, fontSize: 28, bold: true })
  const objectives = data.engagement.objectives.map((objective, index) => ({
    text: `${index + 1}. ${trimLine(objective, 130)}`,
    options: { bullet: { indent: 14 } },
  }))
  slide3.addText(objectives, { x: 0.7, y: 1.3, w: 11.5, h: 4.8, fontSize: 18 })

  data.steps.slice(0, 5).forEach((step) => {
    const slide = pptx.addSlide()
    slide.addText(`Step ${step.step_number}: ${step.step_name}`, {
      x: 0.5, y: 0.4, w: 12, h: 0.6, fontSize: 24, bold: true,
    })
    slide.addText(`Confidence: ${step.confidence}`, { x: 0.5, y: 1.1, w: 5, h: 0.3, fontSize: 12, color: '475467' })

    step.frameworks.slice(0, 6).forEach((framework, index) => {
      const y = 1.6 + index * 0.78
      slide.addText(`${framework.name}:`, {
        x: 0.6, y, w: 2.8, h: 0.3, fontSize: 13, bold: true,
      })
      slide.addText(trimLine(JSON.stringify(framework.output), 170), {
        x: 3.1, y, w: 9.2, h: 0.5, fontSize: 11,
      })
    })
  })

  const riskSlide = pptx.addSlide()
  riskSlide.addText('Risk Register', { x: 0.5, y: 0.4, w: 12, h: 0.6, fontSize: 28, bold: true })
  const riskRows = [
    [
      { text: 'Impact →\nProbability ↓', options: { bold: true } },
      { text: 'Low', options: { fill: { color: 'E8F5E9' } } },
      { text: 'Medium', options: { fill: { color: 'FFF9C4' } } },
      { text: 'High', options: { fill: { color: 'FFCCBC' } } },
    ],
    [{ text: 'Low', options: { bold: true } }, { text: '1' }, { text: '2' }, { text: '3' }],
    [{ text: 'Medium', options: { bold: true } }, { text: '2' }, { text: '4' }, { text: '6' }],
    [{ text: 'High', options: { bold: true } }, { text: '3' }, { text: '6' }, { text: '9' }],
  ]
  riskSlide.addTable(riskRows as any, { x: 0.6, y: 1.4, w: 5.0, h: 2.8, fontSize: 12 })
  const topRisks = data.risks.slice(0, 7).map((risk) => `${risk.code}: ${trimLine(risk.title, 50)} (Score: ${risk.score})`)
  riskSlide.addText(topRisks.join('\n'), { x: 6.0, y: 1.4, w: 6.5, h: 4.8, fontSize: 12 })

  const optionsSlide = pptx.addSlide()
  optionsSlide.addText('Strategic Options', { x: 0.5, y: 0.4, w: 12, h: 0.6, fontSize: 28, bold: true })
  const optionsTable = [
    [{ text: 'Option' }, { text: 'Pros' }, { text: 'Cons' }, { text: 'Cost' }, { text: 'Rec.' }],
    ...data.options.slice(0, 4).map((option) => [
      { text: trimLine(option.title, 35) },
      { text: trimLine(option.pros.slice(0, 3).join('\n'), 140) },
      { text: trimLine(option.cons.slice(0, 3).join('\n'), 140) },
      { text: option.cost_range },
      { text: option.recommended ? '✓' : '' },
    ]),
  ]
  optionsSlide.addTable(optionsTable as any, { x: 0.5, y: 1.4, w: 12.2, h: 4.8, fontSize: 11 })

  const recSlide = pptx.addSlide()
  recSlide.addText('Recommendations', { x: 0.5, y: 0.4, w: 12, h: 0.6, fontSize: 28, bold: true })
  recSlide.addText(trimLine(data.recommendations, 1600), { x: 0.6, y: 1.4, w: 12.0, h: 5.2, fontSize: 14, valign: 'top' })

  const output = await pptx.write({ outputType: 'nodebuffer' })
  return Buffer.isBuffer(output) ? output : Buffer.from(output as ArrayBuffer)
}
