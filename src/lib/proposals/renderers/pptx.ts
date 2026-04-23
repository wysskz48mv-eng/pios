/**
 * PowerPoint (.pptx) pitch-deck builder.
 *
 * 10-slide deck mapped from the proposal:
 *   1. Title
 *   2. Understanding the brief
 *   3. Objectives
 *   4. Approach
 *   5. Frameworks
 *   6. Deliverables
 *   7. Team
 *   8. Schedule
 *   9. Commercials
 *  10. Why us
 */

import PptxGenJS from 'pptxgenjs';
import type { Proposal, ProposalRequirement } from '../types';

const BRAND_NAVY = '1E3A5F';
const BRAND_TEAL = '2AA198';
const BRAND_SLATE = '334155';
const BRAND_LIGHT = 'F8FAFC';

export async function buildPptx(
  proposal: Proposal,
  _requirements: ProposalRequirement[],
): Promise<{ buffer: Buffer; slideCount: number }> {
  const p = new PptxGenJS();
  p.layout = 'LAYOUT_WIDE';
  p.title = proposal.title;
  p.company = 'VeritasIQ Technologies Ltd';

  const addFooter = (slide: PptxGenJS.Slide) => {
    slide.addText(
      [
        { text: 'VeritasIQ Technologies Ltd · Confidential', options: { fontSize: 9, color: BRAND_SLATE } },
      ],
      { x: 0.3, y: 7.1, w: 8, h: 0.3 },
    );
    slide.addText(
      [{ text: 'info@veritasiq.io', options: { fontSize: 9, color: BRAND_SLATE } }],
      { x: 10.5, y: 7.1, w: 2.7, h: 0.3, align: 'right' },
    );
  };

  // ---- Slide 1: Title
  {
    const s = p.addSlide();
    s.background = { color: BRAND_NAVY };
    s.addText('VeritasIQ Technologies Ltd', {
      x: 0.5, y: 0.4, w: 12, h: 0.5, fontSize: 14, color: 'FFFFFF',
    });
    s.addText(proposal.title, {
      x: 0.5, y: 2.8, w: 12, h: 1.5, fontSize: 40, bold: true, color: 'FFFFFF',
    });
    if (proposal.client_org) {
      s.addText(`Prepared for ${proposal.client_org}`, {
        x: 0.5, y: 4.4, w: 12, h: 0.5, fontSize: 20, color: BRAND_TEAL,
      });
    }
    if (proposal.rfp_reference) {
      s.addText(`RFP: ${proposal.rfp_reference}`, {
        x: 0.5, y: 5.0, w: 12, h: 0.4, fontSize: 14, color: 'FFFFFF',
      });
    }
    s.addText(`Issued ${new Date().toLocaleDateString('en-GB')}`, {
      x: 0.5, y: 6.8, w: 12, h: 0.4, fontSize: 12, color: BRAND_LIGHT,
    });
  }

  // ---- Slide 2: Understanding
  {
    const s = p.addSlide();
    slideHeader(s, 'Understanding the brief');
    s.addText(proposal.problem_statement ?? 'Problem statement to be generated.', {
      x: 0.5, y: 1.5, w: 12, h: 4, fontSize: 18, color: BRAND_SLATE, valign: 'top',
    });
    addFooter(s);
  }

  // ---- Slide 3: Objectives
  {
    const s = p.addSlide();
    slideHeader(s, 'What success looks like');
    if (proposal.objectives?.length) {
      s.addText(
        proposal.objectives.map((o) => ({ text: o, options: { bullet: { code: '25A0' } } })),
        { x: 0.5, y: 1.5, w: 12, h: 5, fontSize: 18, color: BRAND_SLATE, paraSpaceAfter: 6 },
      );
    }
    addFooter(s);
  }

  // ---- Slide 4: Approach
  {
    const s = p.addSlide();
    slideHeader(s, 'Our approach');
    const approachMd = (proposal.proposed_approach as { markdown?: string })?.markdown ?? '';
    s.addText(approachMd || 'Approach narrative will render after drafting.', {
      x: 0.5, y: 1.5, w: 12, h: 5, fontSize: 16, color: BRAND_SLATE, valign: 'top',
    });
    addFooter(s);
  }

  // ---- Slide 5: Frameworks
  {
    const s = p.addSlide();
    slideHeader(s, 'Frameworks we will apply');
    if (proposal.recommended_frameworks?.length) {
      s.addTable(
        [
          [
            { text: 'Code', options: { bold: true, fill: { color: BRAND_NAVY }, color: 'FFFFFF' } },
            { text: 'Framework', options: { bold: true, fill: { color: BRAND_NAVY }, color: 'FFFFFF' } },
            { text: 'Why it fits', options: { bold: true, fill: { color: BRAND_NAVY }, color: 'FFFFFF' } },
          ],
          ...proposal.recommended_frameworks.map((f) => [
            { text: f.framework_code },
            { text: f.name },
            { text: f.rationale },
          ]),
        ] as any,
        { x: 0.5, y: 1.5, w: 12, fontSize: 14, border: { type: 'solid', color: 'E5E7EB', pt: 1 } },
      );
    }
    addFooter(s);
  }

  // ---- Slide 6: Deliverables
  {
    const s = p.addSlide();
    slideHeader(s, 'Deliverables');
    if (proposal.deliverables?.length) {
      s.addTable(
        [
          [
            { text: 'Deliverable', options: { bold: true, fill: { color: BRAND_NAVY }, color: 'FFFFFF' } },
            { text: 'Description', options: { bold: true, fill: { color: BRAND_NAVY }, color: 'FFFFFF' } },
            { text: 'Week', options: { bold: true, fill: { color: BRAND_NAVY }, color: 'FFFFFF' } },
          ],
          ...proposal.deliverables.map((d) => [
            { text: d.title },
            { text: d.description },
            { text: String(d.week ?? '—') },
          ]),
        ] as any,
        { x: 0.5, y: 1.5, w: 12, fontSize: 12, border: { type: 'solid', color: 'E5E7EB', pt: 1 } },
      );
    }
    addFooter(s);
  }

  // ---- Slide 7: Team
  {
    const s = p.addSlide();
    slideHeader(s, 'Team & governance');
    if (proposal.team_composition?.length) {
      s.addText(
        proposal.team_composition.map((m) => ({
          text: `${m.name} (${m.role}) — ${m.bio_snippet ?? ''}`,
          options: { bullet: true },
        })),
        { x: 0.5, y: 1.5, w: 12, h: 5, fontSize: 16, color: BRAND_SLATE, paraSpaceAfter: 6 },
      );
    }
    addFooter(s);
  }

  // ---- Slide 8: Schedule
  {
    const s = p.addSlide();
    slideHeader(s, 'Indicative schedule');
    if (proposal.schedule?.length) {
      const totalWeeks = Math.max(...proposal.schedule.map((p2) => p2.end_week), 1);
      proposal.schedule.forEach((phase, idx) => {
        const y = 1.5 + idx * 0.55;
        const barX = 3 + ((phase.start_week - 1) / totalWeeks) * 9;
        const barW = Math.max(0.3, ((phase.end_week - phase.start_week + 1) / totalWeeks) * 9);
        s.addText(phase.phase_name, { x: 0.5, y, w: 2.5, h: 0.4, fontSize: 11, color: BRAND_SLATE });
        s.addShape('rect', {
          x: barX, y: y + 0.08, w: barW, h: 0.28,
          fill: { color: BRAND_TEAL }, line: { color: BRAND_TEAL, width: 0 },
        });
        s.addText(`W${phase.start_week}–${phase.end_week}`, {
          x: barX + barW + 0.1, y, w: 1.5, h: 0.4, fontSize: 10, color: BRAND_SLATE,
        });
      });
    }
    addFooter(s);
  }

  // ---- Slide 9: Commercials
  {
    const s = p.addSlide();
    slideHeader(s, 'Commercials');
    const cm = proposal.commercial_model ?? {};
    const currency = cm.currency ?? proposal.currency ?? 'GBP';
    const fee =
      cm.fee_total ??
      (proposal.day_rate && proposal.estimated_days
        ? proposal.day_rate * proposal.estimated_days
        : null);
    s.addTable(
      [
        [{ text: 'Basis' }, { text: cm.basis ?? 'Time & materials' }],
        [{ text: 'Day rate' }, { text: proposal.day_rate ? `${currency} ${proposal.day_rate.toLocaleString('en-GB')}` : '—' }],
        [{ text: 'Estimated days' }, { text: proposal.estimated_days?.toString() ?? '—' }],
        [{ text: 'Total fee' }, { text: fee !== null ? `${currency} ${fee.toLocaleString('en-GB')}` : '—' }],
        [{ text: 'Payment schedule' }, { text: cm.payment_schedule ?? 'Monthly against narrative invoice' }],
      ] as any,
      { x: 0.5, y: 1.5, w: 12, fontSize: 16, border: { type: 'solid', color: 'E5E7EB', pt: 1 } },
    );
    addFooter(s);
  }

  // ---- Slide 10: Why us
  {
    const s = p.addSlide();
    slideHeader(s, 'Why VeritasIQ');
    if (proposal.win_themes?.length) {
      s.addText(
        proposal.win_themes.map((t) => ({ text: t, options: { bullet: { code: '2605' } } })),
        { x: 0.5, y: 1.5, w: 12, h: 5, fontSize: 18, color: BRAND_SLATE, paraSpaceAfter: 8 },
      );
    }
    addFooter(s);
  }

  const raw = await p.write({ outputType: 'nodebuffer' });
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
  return { buffer, slideCount: 10 };
}

function slideHeader(slide: PptxGenJS.Slide, title: string) {
  slide.background = { color: 'FFFFFF' };
  slide.addShape('rect', {
    x: 0, y: 0, w: 13.33, h: 0.1, fill: { color: BRAND_TEAL }, line: { color: BRAND_TEAL, width: 0 },
  });
  slide.addText(title, {
    x: 0.5, y: 0.4, w: 12, h: 0.8, fontSize: 28, bold: true, color: BRAND_NAVY,
  });
}
