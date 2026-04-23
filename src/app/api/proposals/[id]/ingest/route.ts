/**
 * POST /api/proposals/[id]/ingest
 *   body: IngestRequest
 * Ingests a brief/RFP/email/URL/transcript into a proposal, extracts
 * requirements, and populates the problem_statement + objectives fields.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runIngest } from '@/lib/proposals/pipeline';
import type { IngestRequest } from '@/lib/proposals/types';

export const maxDuration = 60;

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

  // Verify the proposal exists and is owned by the caller (belt-and-braces on RLS).
  const { data: proposal } = await sb
    .from('proposals')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle();
  if (!proposal || proposal.user_id !== user.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const body = (await request.json()) as IngestRequest;
  if (!body.source_type) {
    return NextResponse.json({ error: 'source_type is required' }, { status: 400 });
  }
  if (!body.raw_text && !body.file_item_id && !body.source_url) {
    return NextResponse.json(
      { error: 'one of raw_text, file_item_id, or source_url is required' },
      { status: 400 },
    );
  }

  try {
    const result = await runIngest(sb, id, user.id, body);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'ingest failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
