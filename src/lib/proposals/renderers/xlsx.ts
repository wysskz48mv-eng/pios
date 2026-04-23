/**
 * Excel (.xlsx) builder — commercial schedule + compliance matrix.
 *
 * Three sheets:
 *   1. "Summary" — client, rfp ref, due date, total fee, status.
 *   2. "Commercials" — line items with formulas: day_rate × days = fee.
 *   3. "Compliance" — every requirement with our response and status.
 *   4. "Schedule" — Gantt-style weekly matrix.
 *
 * ExcelJS is used because it is pure-JS and runs under Node on Vercel.
 */

import ExcelJS from 'exceljs';
import type { Proposal, ProposalRequirement } from '../types';

const BRAND_NAVY = 'FF1E3A5F';
const BRAND_TEAL = 'FF2AA198';
const BRAND_LIGHT = 'FFF8FAFC';

export async function buildXlsx(
  proposal: Proposal,
  requirements: ProposalRequirement[],
): Promise<{ buffer: Buffer; sheetCount: number }> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'VeritasIQ Technologies Ltd';
  wb.created = new Date();
  wb.company = 'VeritasIQ Technologies Ltd';

  const currency = proposal.commercial_model?.currency ?? proposal.currency ?? 'GBP';
  const fmtCurrency = `"${currency}" #,##0.00`;

  // --------------------------------------------- 1. Summary
  const s1 = wb.addWorksheet('Summary', {
    properties: { tabColor: { argb: BRAND_TEAL } },
    views: [{ showGridLines: false }],
  });
  s1.columns = [{ width: 30 }, { width: 60 }];
  s1.mergeCells('A1:B1');
  s1.getCell('A1').value = 'VeritasIQ Consulting Proposal';
  s1.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  s1.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_NAVY } };
  s1.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
  s1.getRow(1).height = 32;

  const summaryRows: Array<[string, unknown]> = [
    ['Title', proposal.title],
    ['Client', proposal.client_org ?? '—'],
    ['RFP reference', proposal.rfp_reference ?? '—'],
    ['Submission due', proposal.submission_due_at ? new Date(proposal.submission_due_at) : '—'],
    ['Status', proposal.status ?? proposal.generation_status],
    ['Currency', currency],
    ['Day rate', proposal.day_rate ?? '—'],
    ['Estimated days', proposal.estimated_days ?? '—'],
    ['Total fee (computed)', '=IF(AND(ISNUMBER(B7),ISNUMBER(B8)),B7*B8,"—")'],
  ];
  summaryRows.forEach((row, idx) => {
    const r = s1.getRow(idx + 3);
    r.getCell(1).value = row[0];
    r.getCell(1).font = { bold: true };
    r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_LIGHT } };
    if (typeof row[1] === 'string' && row[1].startsWith('=')) r.getCell(2).value = { formula: row[1].slice(1) };
    else r.getCell(2).value = row[1] as ExcelJS.CellValue;
    if (row[0] === 'Day rate' || row[0] === 'Total fee (computed)') r.getCell(2).numFmt = fmtCurrency;
  });

  // --------------------------------------------- 2. Commercials
  const s2 = wb.addWorksheet('Commercials', { views: [{ showGridLines: false }] });
  s2.columns = [
    { header: 'Line', key: 'line', width: 8 },
    { header: 'Role / resource', key: 'role', width: 28 },
    { header: 'Day rate', key: 'rate', width: 14, style: { numFmt: fmtCurrency } },
    { header: 'Days', key: 'days', width: 10 },
    { header: 'Line fee', key: 'fee', width: 16, style: { numFmt: fmtCurrency } },
    { header: 'Notes', key: 'notes', width: 40 },
  ];
  styleHeaderRow(s2);

  const team = proposal.team_composition ?? [];
  if (team.length === 0) {
    // Fallback single-line row
    s2.addRow({
      line: 1, role: 'Lead consultant',
      rate: proposal.day_rate ?? null,
      days: proposal.estimated_days ?? null,
      fee: { formula: `C2*D2` },
      notes: '',
    });
  } else {
    team.forEach((m, idx) => {
      const r = idx + 2;
      const allocDays = m.allocation_pct && proposal.estimated_days
        ? Math.round((m.allocation_pct / 100) * proposal.estimated_days)
        : null;
      s2.addRow({
        line: idx + 1,
        role: `${m.name} — ${m.role}`,
        rate: proposal.day_rate ?? null,
        days: allocDays,
        fee: { formula: `C${r}*D${r}` },
        notes: m.bio_snippet ?? '',
      });
    });
  }
  // Total row
  const lastRow = s2.lastRow!.number;
  const totalRow = s2.addRow({
    line: '',
    role: 'TOTAL',
    rate: '',
    days: { formula: `SUM(D2:D${lastRow})` },
    fee: { formula: `SUM(E2:E${lastRow})` },
    notes: '',
  });
  totalRow.font = { bold: true };
  totalRow.getCell('fee').numFmt = fmtCurrency;

  // --------------------------------------------- 3. Compliance
  const s3 = wb.addWorksheet('Compliance Matrix', { views: [{ showGridLines: false }] });
  s3.columns = [
    { header: '#', key: 'idx', width: 6 },
    { header: 'Priority', key: 'priority', width: 12 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Requirement', key: 'title', width: 40 },
    { header: 'Source', key: 'source', width: 14 },
    { header: 'Our response', key: 'response', width: 60 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Confidence', key: 'confidence', width: 12 },
  ];
  styleHeaderRow(s3);

  requirements.forEach((r, idx) => {
    const row = s3.addRow({
      idx: idx + 1,
      priority: r.priority,
      type: r.requirement_type,
      title: r.title,
      source: r.source_page ?? '—',
      response: r.our_response ?? '',
      status: r.response_status,
      confidence: r.confidence ?? null,
    });
    // Colour-code status
    const statusCell = row.getCell('status');
    const colour =
      r.response_status === 'confirmed' ? 'FFDCFCE7' :
      r.response_status === 'drafted' ? 'FFFEF3C7' :
      r.response_status === 'gap' ? 'FFFECACA' : 'FFF1F5F9';
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colour } };
  });
  s3.autoFilter = { from: 'A1', to: 'H1' };

  // --------------------------------------------- 4. Schedule (Gantt)
  const s4 = wb.addWorksheet('Schedule', { views: [{ showGridLines: false }] });
  const phases = proposal.schedule ?? [];
  const maxWeek = phases.length > 0 ? Math.max(...phases.map((p) => p.end_week)) : 12;
  s4.columns = [
    { header: 'Phase', key: 'phase', width: 6 },
    { header: 'Name', key: 'name', width: 30 },
    ...Array.from({ length: maxWeek }, (_, i) => ({
      header: `W${i + 1}`, key: `w${i + 1}`, width: 5,
    })),
  ];
  styleHeaderRow(s4);

  phases.forEach((phase) => {
    const rowData: Record<string, unknown> = { phase: `P${phase.phase_no}`, name: phase.phase_name };
    const row = s4.addRow(rowData);
    for (let w = phase.start_week; w <= phase.end_week; w++) {
      const cell = row.getCell(`w${w}`);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_TEAL } };
    }
  });

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return { buffer: Buffer.from(arrayBuffer), sheetCount: 4 };
}

function styleHeaderRow(sheet: ExcelJS.Worksheet) {
  const r = sheet.getRow(1);
  r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_NAVY } };
  r.height = 22;
  r.alignment = { vertical: 'middle' };
}
