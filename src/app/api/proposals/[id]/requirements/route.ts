/**
 * GET /api/proposals/[id]/requirements
 *   Returns all extracted requirements for this proposal.
 *
 * PATCH /api/proposals/[id]/requirements
 *   body: { requirement_id, our_response?, response_status?, priority? }
 *   Allows a user to edit a single requirement — typically to write
 *   the "our_response" that feeds the compliance matrix.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Priority, ResponseStatus } from '@/lib/proposals/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await createClient();
  const { data, error } = await sb
    .from('proposal_requirements')
    .select('*')
    .eq('proposal_id', id)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requirements: data ?? [] });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const body = (await request.json()) as {
    requirement_id: string;
    our_response?: string;
    response_status?: ResponseStatus;
    priority?: Priority;
  };

  if (!body.requirement_id) {
    return NextResponse.json({ error: 'requirement_id required' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.our_response === 'string') patch.our_response = body.our_response;
  if (body.response_status) patch.response_status = body.response_status;
  if (body.priority) patch.priority = body.priority;

  const { data, error } = await sb
    .from('proposal_requirements')
    .update(patch)
    .eq('id', body.requirement_id)
    .eq('proposal_id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requirement: data });
}
