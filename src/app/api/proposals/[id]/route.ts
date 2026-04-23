/**
 * GET /api/proposals/[id]
 *   Returns the proposal plus its intake documents, requirements, outputs,
 *   and the 20 most recent AI runs for the observability panel.
 *
 * PATCH /api/proposals/[id]
 *   Partial update for any user-editable proposal column (used by the
 *   structured form after the AI has drafted).
 *
 * DELETE /api/proposals/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await createClient();

  const [proposalRes, intakeRes, reqRes, outRes, runRes] = await Promise.all([
    sb.from('proposals').select('*').eq('id', id).maybeSingle(),
    sb.from('proposal_intake_documents').select('*').eq('proposal_id', id).order('created_at', { ascending: false }),
    sb.from('proposal_requirements').select('*').eq('proposal_id', id).order('priority').order('created_at'),
    sb.from('proposal_outputs').select('*').eq('proposal_id', id).order('created_at', { ascending: false }),
    sb.from('proposal_ai_runs').select('*').eq('proposal_id', id).order('created_at', { ascending: false }).limit(20),
  ]);

  if (!proposalRes.data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  return NextResponse.json({
    proposal: proposalRes.data,
    intake_documents: intakeRes.data ?? [],
    requirements: reqRes.data ?? [],
    outputs: outRes.data ?? [],
    recent_runs: runRes.data ?? [],
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await createClient();
  const body = (await request.json()) as Record<string, unknown>;

  // Allow-list — anything else is rejected silently.
  const allowed = new Set([
    'title',
    'client_org',
    'client_contact',
    'rfp_reference',
    'submission_due_at',
    'problem_statement',
    'objectives',
    'proposed_approach',
    'methodology',
    'deliverables',
    'team_composition',
    'schedule',
    'commercial_model',
    'assumptions',
    'risks',
    'case_studies',
    'recommended_frameworks',
    'win_themes',
    'compliance_matrix',
    'fee_gbp',
    'day_rate',
    'estimated_days',
    'currency',
    'notes',
    'status',
  ]);
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) if (allowed.has(k)) patch[k] = v;

  const { data: current } = await sb.from('proposals').select('version').eq('id', id).maybeSingle();
  patch.version = ((current?.version as number | null) ?? 0) + 1;

  const { data, error } = await sb
    .from('proposals')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ proposal: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await createClient();
  const { error } = await sb.from('proposals').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
