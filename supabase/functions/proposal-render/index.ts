// supabase/functions/proposal-render/index.ts
//
// PIOS M115 — Proposal output renderer (Edge Function, Deno runtime).
//
// Payload:
//   { proposal_id: string, output_ids: string[] }
//
// For each queued output row:
//   1. Load proposal + requirements + section templates.
//   2. Assemble the section markdown (from structured columns).
//   3. Call the right builder (docx/pptx/xlsx/pdf/md/html).
//   4. Upload the file to the `proposal-outputs` storage bucket.
//   5. Update the proposal_outputs row with storage_path + public_url.
//
// The actual binary-format building (docx/pptx/xlsx) happens in a thin
// Node sidecar service hosted on Vercel (route: /api/internal/render-doc).
// This Edge Function just calls that sidecar with a signed internal JWT.
// Rationale: python-docx / python-pptx / openpyxl are the battle-tested
// builders used by the PIOS skill system; Deno's ecosystem for these
// formats is thinner. Edge Function stays thin + fast; the Vercel Node
// route handles the heavy lifting.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RenderPayload {
  proposal_id: string;
  output_ids: string[];
}

interface OutputRow {
  id: string;
  output_format: 'docx' | 'pdf' | 'pptx' | 'xlsx' | 'md' | 'html';
  output_kind: string;
  template_used: string | null;
  version: number;
}

const BUCKET = 'proposal-outputs';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  const payload = (await req.json()) as RenderPayload;
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Load proposal + requirements — these are the inputs for every render.
  const { data: proposal } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', payload.proposal_id)
    .single();

  if (!proposal) {
    return Response.json({ error: 'proposal not found' }, { status: 404 });
  }

  const { data: requirements } = await supabase
    .from('proposal_requirements')
    .select('*')
    .eq('proposal_id', payload.proposal_id);

  const { data: outputRows } = await supabase
    .from('proposal_outputs')
    .select('*')
    .in('id', payload.output_ids);

  const sidecar = Deno.env.get('PIOS_RENDER_SIDECAR_URL')!;
  const sidecarSecret = Deno.env.get('PIOS_RENDER_SIDECAR_SECRET')!;

  const results = await Promise.all(
    ((outputRows ?? []) as OutputRow[]).map(async (row) => {
      try {
        await supabase
          .from('proposal_outputs')
          .update({ render_status: 'rendering' })
          .eq('id', row.id);

        const body = JSON.stringify({
          output_id: row.id,
          output_format: row.output_format,
          output_kind: row.output_kind,
          template_pack: row.template_used,
          proposal,
          requirements,
        });

        const resp = await fetch(sidecar, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-pios-render-secret': sidecarSecret,
          },
          body,
        });

        if (!resp.ok) {
          const err = await resp.text();
          throw new Error(`sidecar ${resp.status}: ${err}`);
        }

        // Sidecar returns the storage_path after uploading to the bucket.
        const json = (await resp.json()) as {
          storage_path: string;
          file_size: number;
          page_count?: number;
          checksum_sha256: string;
        };

        // Create a signed URL (7 days) — the UI can re-fetch via API if expired.
        const signed = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(json.storage_path, 60 * 60 * 24 * 7);

        await supabase
          .from('proposal_outputs')
          .update({
            storage_path: json.storage_path,
            public_url: signed.data?.signedUrl ?? null,
            file_size: json.file_size,
            page_count: json.page_count ?? null,
            checksum_sha256: json.checksum_sha256,
            render_status: 'ready',
            rendered_at: new Date().toISOString(),
          })
          .eq('id', row.id);

        return { id: row.id, ok: true };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await supabase
          .from('proposal_outputs')
          .update({ render_status: 'failed', render_error: message })
          .eq('id', row.id);
        return { id: row.id, ok: false, error: message };
      }
    }),
  );

  return Response.json({ results });
});
