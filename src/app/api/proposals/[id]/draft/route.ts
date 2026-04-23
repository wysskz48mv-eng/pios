/**
 * POST /api/proposals/[id]/draft
 *   body: DraftRequest
 * Drafts the requested sections (or all defaults) using the Sonnet tier
 * with Haiku fallback. Writes results back into structured columns on
 * the proposals row and logs token usage.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runDraft } from '@/lib/proposals/pipeline';
import type { DraftRequest } from '@/lib/proposals/types';

export const maxDuration = 300; // longer — multi-section draft can take a while

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
    .select('id, user_id, generation_status')
    .eq('id', id)
    .maybeSingle();
  if (!proposal || proposal.user_id !== user.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  if (['ingesting', 'analysing', 'drafting', 'rendering'].includes(proposal.generation_status)) {
    return NextResponse.json(
      { error: `proposal is currently ${proposal.generation_status}; wait for it to finish` },
      { status: 409 },
    );
  }

  const body = ((await request.json().catch(() => ({}))) ?? {}) as DraftRequest;

  try {
    const result = await runDraft(sb, id, user.id, body);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'draft failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
