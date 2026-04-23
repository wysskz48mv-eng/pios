/**
 * Word (.docx) builder for a full consulting proposal.
 *
 * Uses the `docx` npm package so the build happens in pure Node
 * (no Python, no headless browser). The layout follows VeritasIQ
 * house style: title page, ToC placeholder, then the drafted sections.
 *
 * Section order is deliberate — mirrors the order a bid reviewer reads:
 *   1. Exec summary        (derived from problem + win themes + commercials)
 *   2. Understanding       (problem_statement + objectives)
 *   3. Approach            (proposed_approach + methodology)
 *   4. Deliverables
 *   5. Team
 *   6. Schedule
 *   7. Commercials
 *   8. Assumptions
 *   9. Risks
 *  10. Compliance matrix   (requirements tagged as mandatory/evaluation)
 *  11. Why VeritasIQ       (win_themes + case studies)
 */

import {
  AlignmentType,
  Document,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { Proposal, ProposalRequirement } from '../types';

const BRAND_NAVY = '1E3A5F';
const BRAND_TEAL = '2AA198';
const GREY = '64748B';

export async function buildDocx(
  proposal: Proposal,
  requirements: ProposalRequirement[],
): Promise<{ buffer: Buffer; pageCount: number }> {
  const title = proposal.title || 'Consulting Proposal';
  const clientLine = proposal.client_org ? `Prepared for ${proposal.client_org}` : '';
  const rfpLine = proposal.rfp_reference ? `RFP reference: ${proposal.rfp_reference}` : '';
  const dueLine = proposal.submission_due_at
    ? `Submission due: ${new Date(proposal.submission_due_at).toLocaleDateString('en-GB')}`
    : '';

  const children: Array<Paragraph | Table> = [];

  // ------------------------------- Title page
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2400, after: 400 },
      children: [
        new TextRun({ text: 'VeritasIQ Technologies Ltd', bold: true, color: BRAND_NAVY, size: 28 }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 2000 },
      children: [new TextRun({ text: 'Consulting Proposal', color: GREY, size: 22 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: title, bold: true, size: 44, color: BRAND_NAVY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [new TextRun({ text: clientLine, size: 24 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: rfpLine, size: 20, color: GREY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: dueLine, size: 20, color: GREY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 4800 },
      children: [
        new TextRun({
          text: `Issued ${new Date().toLocaleDateString('en-GB')} · info@veritasiq.io`,
          size: 18,
          color: GREY,
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ------------------------------- Executive summary
  children.push(
    h1('Executive Summary'),
    para(
      proposal.problem_statement
        ? `${proposal.client_org ?? 'The client'} is seeking a partner to ${proposal.problem_statement.replace(
            /\.$/,
            '',
          )}. This proposal sets out VeritasIQ's understanding, approach, team, schedule, and commercials.`
        : 'Executive summary will be generated once the brief has been ingested.',
    ),
  );

  if (proposal.win_themes?.length) {
    children.push(h3('Why VeritasIQ wins here'));
    for (const theme of proposal.win_themes) children.push(bullet(theme));
  }

  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ------------------------------- Understanding
  children.push(h1('Understanding the Brief'));
  if (proposal.problem_statement) children.push(para(proposal.problem_statement));
  if (proposal.objectives?.length) {
    children.push(h3('Key objectives'));
    for (const o of proposal.objectives) children.push(bullet(o));
  }

  // ------------------------------- Approach
  children.push(h1('Our Approach'));
  const approachMd = (proposal.proposed_approach as { markdown?: string })?.markdown;
  if (approachMd) children.push(...markdownToParagraphs(approachMd));
  else children.push(para('Approach will appear here after the drafting step.'));

  if (proposal.recommended_frameworks?.length) {
    children.push(h3('Frameworks we will apply'));
    for (const f of proposal.recommended_frameworks) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: `${f.framework_code}  `, bold: true, color: BRAND_TEAL }),
            new TextRun({ text: `${f.name} — `, bold: true }),
            new TextRun({ text: f.rationale }),
          ],
        }),
      );
    }
  }

  // ------------------------------- Deliverables
  children.push(h1('Deliverables'));
  if (proposal.deliverables?.length) {
    children.push(
      table(
        ['Deliverable', 'Description', 'Week', 'Owner'],
        proposal.deliverables.map((d) => [d.title, d.description, d.week?.toString() ?? '—', d.owner ?? '—']),
      ),
    );
  } else children.push(para('Deliverables will be listed here after drafting.'));

  // ------------------------------- Team
  children.push(h1('Team & Governance'));
  if (proposal.team_composition?.length) {
    for (const m of proposal.team_composition) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: `${m.name} `, bold: true }),
            new TextRun({ text: `(${m.role}) — `, color: GREY }),
            new TextRun({ text: m.bio_snippet ?? '' }),
          ],
        }),
      );
    }
  } else children.push(para('Team composition will appear here.'));

  // ------------------------------- Schedule
  children.push(h1('Indicative Schedule'));
  if (proposal.schedule?.length) {
    children.push(
      table(
        ['Phase', 'Name', 'Start', 'End', 'Key activities'],
        proposal.schedule.map((p) => [
          `P${p.phase_no}`,
          p.phase_name,
          `Wk ${p.start_week}`,
          `Wk ${p.end_week}`,
          p.key_activities.join('; '),
        ]),
      ),
    );
  } else children.push(para('Schedule will appear here.'));

  // ------------------------------- Commercials
  children.push(h1('Commercials'));
  const cm = proposal.commercial_model ?? ({} as Proposal['commercial_model']);
  const feeTotal =
    cm.fee_total ??
    (proposal.day_rate && proposal.estimated_days
      ? proposal.day_rate * proposal.estimated_days
      : null);
  const currency = cm.currency ?? proposal.currency ?? 'GBP';
  children.push(
    table(
      ['Item', 'Value'],
      [
        ['Basis', cm.basis ?? 'Time & materials'],
        ['Day rate', proposal.day_rate ? `${currency} ${proposal.day_rate.toLocaleString('en-GB')}` : '—'],
        ['Estimated days', proposal.estimated_days?.toString() ?? '—'],
        ['Total fee', feeTotal !== null ? `${currency} ${feeTotal.toLocaleString('en-GB')}` : '—'],
        ['Payment schedule', cm.payment_schedule ?? 'Monthly against a narrative invoice'],
        ['Expenses', cm.expenses_policy ?? 'Charged at cost, pre-approved'],
      ],
    ),
  );

  // ------------------------------- Assumptions
  if (proposal.assumptions?.length) {
    children.push(h1('Assumptions & Dependencies'));
    for (const a of proposal.assumptions) children.push(bullet(a));
  }

  // ------------------------------- Risks
  if (proposal.risks?.length) {
    children.push(h1('Risks & Mitigations'));
    children.push(
      table(
        ['Risk', 'Likelihood', 'Impact', 'Mitigation'],
        proposal.risks.map((r) => [r.risk, r.likelihood, r.impact, r.mitigation]),
      ),
    );
  }

  // ------------------------------- Compliance matrix
  const mandatoryReqs = requirements.filter(
    (r) => r.priority === 'mandatory' || r.requirement_type === 'evaluation_criterion',
  );
  if (mandatoryReqs.length > 0) {
    children.push(h1('Compliance Matrix'));
    children.push(
      table(
        ['Requirement', 'Our response', 'Status', 'Source'],
        mandatoryReqs.map((r) => [
          r.title,
          r.our_response ?? '—',
          r.response_status,
          r.source_page ?? '—',
        ]),
      ),
    );
  }

  // ------------------------------- Assemble
  const doc = new Document({
    creator: 'VeritasIQ Technologies Ltd',
    title,
    description: `Consulting proposal ${rfpLine}`,
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
      },
    },
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 260 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: 'VeritasIQ Technologies Ltd · Confidential', color: GREY, size: 16 })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  // docx does not expose page count without rendering. Estimate by child count.
  const pageCount = Math.max(1, Math.round(children.length / 22));
  return { buffer: Buffer.from(buffer), pageCount };
}

// ---------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------
function h1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, color: BRAND_NAVY, size: 32 })],
  });
}
function h3(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, color: BRAND_NAVY, size: 24 })],
  });
}
function para(text: string) {
  return new Paragraph({
    spacing: { after: 160 },
    children: [new TextRun({ text })],
  });
}
function bullet(text: string) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    children: [new TextRun({ text })],
  });
}
function table(header: string[], rows: string[][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: header.map(
          (h) =>
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF' })] }),
              ],
              shading: { fill: BRAND_NAVY },
            }),
        ),
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.map(
              (cell) =>
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: cell })] })],
                }),
            ),
          }),
      ),
    ],
  });
}
function markdownToParagraphs(md: string): Paragraph[] {
  // Minimal converter — headings, bullets, and paragraphs. Good enough for the
  // AI-drafted sections which we instruct to stay tame on formatting.
  const lines = md.split(/\r?\n/);
  const out: Paragraph[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.startsWith('### ')) out.push(h3(trimmed.slice(4)));
    else if (trimmed.startsWith('## ')) out.push(h1(trimmed.slice(3)));
    else if (/^[-*] /.test(trimmed)) out.push(bullet(trimmed.slice(2)));
    else out.push(para(trimmed));
  }
  return out;
}
