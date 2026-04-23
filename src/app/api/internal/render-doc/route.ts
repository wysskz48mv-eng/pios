/**
 * POST /api/internal/render-doc
 *
 * Internal route called by the `proposal-render` Edge Function.
 * Builds a single output file (docx/pdf/pptx/xlsx) and uploads it to
 * the proposal-outputs storage bucket. Returns the storage_path so the
 * Edge Function can update the proposal_outputs row.
 *
 * Auth: x-pios-render-secret header must match PIOS_RENDER_SIDECAR_SECRET.
 * This route is NOT exposed via normal user auth — it's a service-to-service
 * call from the Supabase project.
 */

import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { buildDocx } from '@/lib/proposals/renderers/docx';
import { buildPptx } from '@/lib/proposals/renderers/pptx';
import { buildXlsx } from '@/lib/proposals/renderers/xlsx';
import { buildPdf } from '@/lib/proposals/renderers/pdf';
import type { Proposal, ProposalRequirement } from '@/lib/proposals/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

const BUCKET = 'proposal-outputs';

interface SidecarRequest {
  output_id: string;
  output_format: 'docx' | 'pdf' | 'pptx' | 'xlsx' | 'md' | 'html';
  output_kind: string;
  template_pack: string | null;
  proposal: Proposal;
  requirements: ProposalRequirement[];
}

export async function POST(request: Request) {
  const secret = request.headers.get('x-pios-render-secret');
  if (!secret || secret !== process.env.PIOS_RENDER_SIDECAR_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = (await request.json()) as SidecarRequest;

  let buffer: Buffer;
  let pageCount: number | undefined;
  let contentType: string;
  let extension: string;

  try {
    switch (body.output_format) {
      case 'docx': {
        const out = await buildDocx(body.proposal, body.requirements);
        buffer = out.buffer;
        pageCount = out.pageCount;
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        extension = 'docx';
        break;
      }
      case 'pptx': {
        const out = await buildPptx(body.proposal, body.requirements);
        buffer = out.buffer;
        pageCount = out.slideCount;
        contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        extension = 'pptx';
        break;
      }
      case 'xlsx': {
        const out = await buildXlsx(body.proposal, body.requirements);
        buffer = out.buffer;
        pageCount = out.sheetCount;
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        extension = 'xlsx';
        break;
      }
      case 'pdf': {
        const out = await buildPdf(body.proposal, body.requirements);
        buffer = out.buffer;
        pageCount = out.pageCount;
        contentType = 'application/pdf';
        extension = 'pdf';
        break;
      }
      case 'md':
      case 'html':
      default:
        return NextResponse.json({ error: `format ${body.output_format} not yet wired` }, { status: 400 });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'render error';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Storage key: tenant/user-scoped, version-suffixed.
  const safeTitle = body.proposal.title.replace(/[^a-z0-9]+/gi, '_').slice(0, 60).toLowerCase();
  const storagePath = `${body.proposal.user_id}/${body.proposal.id}/${safeTitle}_${body.output_kind}_v${randomUUID().slice(0, 8)}.${extension}`;
  const checksum = createHash('sha256').update(buffer).digest('hex');

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: false });

  if (uploadErr) {
    return NextResponse.json({ error: `upload failed: ${uploadErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    storage_path: storagePath,
    file_size: buffer.byteLength,
    page_count: pageCount,
    checksum_sha256: checksum,
  });
}
