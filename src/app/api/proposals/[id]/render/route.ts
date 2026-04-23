/**
 * POST /api/proposals/[id]/render
 *   body: RenderRequest
 * Enqueues one or more output documents (docx, pdf, pptx, xlsx) for the
 * proposal and invokes the proposal-render Edge Function which runs the
 * actual document builders.
 *
 * GET /api/proposals/[id]/render
 * Returns the list of proposal_outputs rows so the UI can poll for
 * render completion and present download links.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runRender } from '@/lib/proposals/pipeline';
import type { OutputFormat, RenderRequest } from '@/lib/proposals/types';

export const maxDuration = 60;

const VALID_FORMATS: OutputFormat[] = ['docx', 'pdf', 'pptx', 'xlsx', 'md', 'html'];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const { data: proposal } = await sb
    .from('proposals')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle();
  if (!proposal || proposal.user_id !== user.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const body = (await request.json()) as RenderRequest;
  if (!Array.isArray(body.formats) || body.formats.length === 0) {
    return NextResponse.json({ error: 'formats is required' }, { status: 400 });
  }
  const bad = body.formats.find((f) => !VALID_FORMATS.includes(f));
  if (bad) {
    return NextResponse.json({ error: `invalid format: ${bad}` }, { status: 400 });
  }

  try {
    const result = await runRender(sb, id, user.id, body);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'render failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await createClient();
  const { data, error } = await sb
    .from('proposal_outputs')
    .select('*')
    .eq('proposal_id', id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ outputs: data ?? [] });
}
