import React from 'react';
import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import type { Proposal, ProposalRequirement } from '../types';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: 'Helvetica', color: '#0f172a' },
  h1: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1E3A5F', marginBottom: 6 },
  h2: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#1E3A5F', marginTop: 10, marginBottom: 4 },
  p: { marginBottom: 4, lineHeight: 1.4 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  cellH: { fontFamily: 'Helvetica-Bold', backgroundColor: '#1E3A5F', color: '#fff', padding: 4, fontSize: 9 },
  cell: { padding: 4, fontSize: 9 },
  footer: { position: 'absolute', bottom: 16, left: 32, right: 32, fontSize: 8, color: '#64748b', flexDirection: 'row', justifyContent: 'space-between' },
});

function PdfDoc({ proposal, requirements }: { proposal: Proposal; requirements: ProposalRequirement[] }) {
  const currency = proposal.commercial_model?.currency ?? proposal.currency ?? 'GBP';
  const fee = proposal.commercial_model?.fee_total ?? ((proposal.day_rate ?? 0) * (proposal.estimated_days ?? 0));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>{proposal.title || 'Consulting Proposal'}</Text>
        <Text style={styles.p}>{proposal.client_org ?? 'No client'} · {proposal.rfp_reference ?? 'No reference'}</Text>
        <Text style={styles.p}>Submission due: {proposal.submission_due_at ? new Date(proposal.submission_due_at).toLocaleDateString('en-GB') : '—'}</Text>

        <Text style={styles.h2}>Executive summary</Text>
        <Text style={styles.p}>{proposal.problem_statement ?? 'Pending ingestion/drafting.'}</Text>

        <Text style={styles.h2}>Objectives</Text>
        {(proposal.objectives ?? []).length ? proposal.objectives.map((o, i) => <Text key={i} style={styles.p}>• {o}</Text>) : <Text style={styles.p}>No objectives yet.</Text>}

        <Text style={styles.h2}>Approach</Text>
        <Text style={styles.p}>{(proposal.proposed_approach as { markdown?: string })?.markdown ?? (proposal.proposed_approach as { summary?: string })?.summary ?? 'No approach drafted yet.'}</Text>

        <Text style={styles.h2}>Commercials</Text>
        <Text style={styles.p}>Day rate: {proposal.day_rate ? `${currency} ${proposal.day_rate.toLocaleString('en-GB')}` : '—'}</Text>
        <Text style={styles.p}>Estimated days: {proposal.estimated_days ?? '—'}</Text>
        <Text style={styles.p}>Total fee: {fee ? `${currency} ${fee.toLocaleString('en-GB')}` : '—'}</Text>

        <Text style={styles.h2}>Compliance matrix</Text>
        <View style={styles.row}>
          <Text style={[styles.cellH, { width: '38%' }]}>Requirement</Text>
          <Text style={[styles.cellH, { width: '38%' }]}>Response</Text>
          <Text style={[styles.cellH, { width: '24%' }]}>Status</Text>
        </View>
        {requirements.slice(0, 20).map((r) => (
          <View key={r.id} style={styles.row}>
            <Text style={[styles.cell, { width: '38%' }]}>{r.title}</Text>
            <Text style={[styles.cell, { width: '38%' }]}>{r.our_response ?? '—'}</Text>
            <Text style={[styles.cell, { width: '24%' }]}>{r.response_status}</Text>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>VeritasIQ Technologies Ltd · Confidential</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function buildPdf(proposal: Proposal, requirements: ProposalRequirement[]): Promise<{ buffer: Buffer; pageCount: number }> {
  const stream = await pdf(<PdfDoc proposal={proposal} requirements={requirements} />).toBuffer();
  const buffer: Buffer = await new Promise((resolve, reject) => {
    if (Buffer.isBuffer(stream)) return resolve(stream as Buffer);
    const chunks: Buffer[] = [];
    (stream as NodeJS.ReadableStream)
      .on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject);
  });
  return { buffer, pageCount: 1 };
}
