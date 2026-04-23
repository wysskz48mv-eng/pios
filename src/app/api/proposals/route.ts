/**
 * POST /api/proposals
 *   body: { title: string, intake_mode?: IntakeMode, client_org?: string, ... }
 * Creates a blank proposal shell ready for intake.
 *
 * GET /api/proposals
 *   Returns all proposals the caller owns (RLS enforced).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { IntakeMode } from '@/lib/proposals/types';

export async function POST(request: Request) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const body = (await request.json()) as {
    title: string;
    intake_mode?: IntakeMode;
    client_org?: string;
    rfp_reference?: string;
    engagement_id?: string;
    submission_due_at?: string;
  };

  if (!body.title || body.title.trim().length === 0) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const { data, error } = await sb
    .from('proposals')
    .insert({
      user_id: user.id,
      title: body.title.trim(),
      intake_mode: body.intake_mode ?? 'manual',
      client_org: body.client_org ?? null,
      rfp_reference: body.rfp_reference ?? null,
      engagement_id: body.engagement_id ?? null,
      submission_due_at: body.submission_due_at ?? null,
      status: 'draft',
      generation_status: 'idle',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ proposal: data }, { status: 201 });
}

export async function GET() {
  const sb = await createClient();
  const { data, error } = await sb
    .from('proposals')
    .select(
      'id, title, client_org, rfp_reference, status, generation_status, generation_progress, submission_due_at, fee_gbp, currency, updated_at',
    )
    .order('updated_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ proposals: data ?? [] });
}
