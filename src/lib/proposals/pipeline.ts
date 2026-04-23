/**
 * PIOS Proposal — pipeline orchestrator
 *
 * This file holds the three coordination functions that the API routes
 * call. Each function updates proposals.generation_status and logs to
 * proposal_ai_runs so the UI progress bar and the admin observability
 * dashboard both stay accurate.
 *
 * Model tiering rule (M064–M068 strategy):
 *   - Extract/classify/QA: Haiku first. Sonnet fallback on rate limit.
 *   - Draft sections:       Sonnet first. Haiku graceful fallback.
 *   - Never silently drop a stage — write a "failed" row instead.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DraftRequest,
  GenerationStatus,
  IngestRequest,
  Proposal,
  ProposalRequirement,
  RenderRequest,
} from './types';
import {
  DRAFT_SECTION_SYSTEM,
  DRAFT_SECTION_USER,
  EXTRACT_REQUIREMENTS_SYSTEM,
  EXTRACT_REQUIREMENTS_USER,
  PROMPT_VERSION,
} from './prompts';
import {
  anthropicComplete,
  type CompletionArgs,
  type CompletionResult,
} from '@/lib/ai/anthropic';

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
async function setStatus(
  sb: SupabaseClient,
  proposalId: string,
  status: GenerationStatus,
  progress: number,
  error?: string,
) {
  await sb
    .from('proposals')
    .update({
      generation_status: status,
      generation_progress: progress,
      generation_error: error ?? null,
      last_ai_run_at: new Date().toISOString(),
    })
    .eq('id', proposalId);
}

async function logRun(
  sb: SupabaseClient,
  params: {
    proposalId: string;
    userId: string;
    stage: string;
    model?: string;
    tier?: 'haiku' | 'sonnet' | 'opus';
    result?: CompletionResult;
    status: 'success' | 'partial' | 'failed' | 'rate_limited' | 'fallback';
    error?: string;
    preview?: string;
  },
) {
  await sb.from('proposal_ai_runs').insert({
    proposal_id: params.proposalId,
    user_id: params.userId,
    stage: params.stage,
    model: params.model ?? null,
    tier: params.tier ?? null,
    prompt_tokens: params.result?.input_tokens ?? null,
    completion_tokens: params.result?.output_tokens ?? null,
    total_tokens: params.result?.total_tokens ?? null,
    latency_ms: params.result?.latency_ms ?? null,
    status: params.status,
    error_message: params.error ?? null,
    output_preview: params.preview?.slice(0, 2000) ?? null,
    metadata: { prompt_version: PROMPT_VERSION },
  });
}

/**
 * Call Anthropic with graceful tier fallback.
 * Extraction/QA default to Haiku; drafting defaults to Sonnet.
 */
async function completeWithFallback(
  args: Omit<CompletionArgs, 'model'> & {
    preferredTier: 'haiku' | 'sonnet';
  },
): Promise<{ result: CompletionResult; model: string; tier: 'haiku' | 'sonnet'; usedFallback: boolean }> {
  const primary =
    args.preferredTier === 'haiku'
      ? { model: 'claude-haiku-4-5-20251001' as const, tier: 'haiku' as const }
      : { model: 'claude-sonnet-4-6' as const, tier: 'sonnet' as const };
  const secondary =
    args.preferredTier === 'haiku'
      ? { model: 'claude-sonnet-4-6' as const, tier: 'sonnet' as const }
      : { model: 'claude-haiku-4-5-20251001' as const, tier: 'haiku' as const };

  try {
    const result = await anthropicComplete({ ...args, model: primary.model });
    return { result, model: primary.model, tier: primary.tier, usedFallback: false };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/rate.?limit|overloaded|429/i.test(msg)) {
      const result = await anthropicComplete({ ...args, model: secondary.model });
      return { result, model: secondary.model, tier: secondary.tier, usedFallback: true };
    }
    throw e;
  }
}

// ---------------------------------------------------------------------
// Stage 1: Ingest — extract text from the uploaded RFP/brief, then extract
// structured requirements. Creates rows in proposal_intake_documents and
// proposal_requirements.
// ---------------------------------------------------------------------
export async function runIngest(
  sb: SupabaseClient,
  proposalId: string,
  userId: string,
  req: IngestRequest,
): Promise<{ intakeDocId: string; requirementCount: number }> {
  await setStatus(sb, proposalId, 'ingesting', 10);

  // 1. Create the intake doc row up front so we have somewhere to land the text.
  const { data: intakeDoc, error: intakeErr } = await sb
    .from('proposal_intake_documents')
    .insert({
      proposal_id: proposalId,
      user_id: userId,
      source_type: req.source_type,
      file_item_id: req.file_item_id ?? null,
      source_url: req.source_url ?? null,
      extracted_text: req.raw_text ?? null,
      text_length: req.raw_text?.length ?? null,
      language: req.language ?? 'en',
      extraction_status: req.raw_text ? 'complete' : 'pending',
      extracted_at: req.raw_text ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (intakeErr || !intakeDoc) {
    await setStatus(sb, proposalId, 'failed', 0, intakeErr?.message);
    throw new Error(intakeErr?.message ?? 'Failed to create intake doc');
  }

  // 2. Hydrate text from the file if not passed inline.
  let text = req.raw_text ?? '';
  if (!text && req.file_item_id) {
    // In production this uses the existing file-text-extract edge function
    // that already handles PDF/DOCX/images. For the overlay we declare only.
    const { data: extracted } = await sb.functions.invoke('file-text-extract', {
      body: { file_item_id: req.file_item_id },
    });
    text = (extracted as { text?: string } | null)?.text ?? '';
    await sb
      .from('proposal_intake_documents')
      .update({
        extracted_text: text,
        text_length: text.length,
        extraction_status: text ? 'complete' : 'failed',
        extracted_at: new Date().toISOString(),
      })
      .eq('id', intakeDoc.id);
  }

  if (!text) {
    await setStatus(sb, proposalId, 'failed', 0, 'No text could be extracted from intake source');
    return { intakeDocId: intakeDoc.id, requirementCount: 0 };
  }

  // 3. Extract requirements with Haiku.
  await setStatus(sb, proposalId, 'analysing', 35);

  let parsed: {
    client_org?: string | null;
    rfp_reference?: string | null;
    submission_due_at?: string | null;
    problem_statement?: string;
    objectives?: string[];
    requirements?: Array<Omit<ProposalRequirement, 'id' | 'proposal_id' | 'intake_doc_id' | 'user_id' | 'created_at' | 'updated_at' | 'our_response' | 'response_status' | 'metadata'>>;
    confidence?: number;
  } = {};

  try {
    const { result, model, tier, usedFallback } = await completeWithFallback({
      system: EXTRACT_REQUIREMENTS_SYSTEM,
      user: EXTRACT_REQUIREMENTS_USER(text, req.file_item_id ?? undefined),
      preferredTier: 'haiku',
      responseFormat: 'json',
      maxTokens: 4096,
    });
    parsed = JSON.parse(result.text);

    await logRun(sb, {
      proposalId,
      userId,
      stage: 'extract_requirements',
      model,
      tier,
      result,
      status: usedFallback ? 'fallback' : 'success',
      preview: JSON.stringify(parsed).slice(0, 2000),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await logRun(sb, {
      proposalId,
      userId,
      stage: 'extract_requirements',
      status: 'failed',
      error: msg,
    });
    await setStatus(sb, proposalId, 'failed', 0, `Requirement extraction failed: ${msg}`);
    return { intakeDocId: intakeDoc.id, requirementCount: 0 };
  }

  // 4. Persist top-level fields onto the proposal and the requirements.
  await sb
    .from('proposals')
    .update({
      client_org: parsed.client_org ?? undefined,
      rfp_reference: parsed.rfp_reference ?? undefined,
      submission_due_at: parsed.submission_due_at ?? undefined,
      problem_statement: parsed.problem_statement ?? undefined,
      objectives: parsed.objectives ?? [],
      ai_confidence: parsed.confidence ?? null,
    })
    .eq('id', proposalId);

  let requirementCount = 0;
  if (parsed.requirements?.length) {
    const rows = parsed.requirements.map((r) => ({
      proposal_id: proposalId,
      intake_doc_id: intakeDoc.id,
      user_id: userId,
      requirement_type: r.requirement_type,
      title: r.title,
      detail: r.detail ?? null,
      source_quote: r.source_quote ?? null,
      source_page: r.source_page ?? null,
      priority: r.priority,
      confidence: r.confidence ?? null,
      response_status: 'unaddressed' as const,
    }));
    const { error: insertErr, count } = await sb
      .from('proposal_requirements')
      .insert(rows, { count: 'exact' });
    if (insertErr) {
      await logRun(sb, {
        proposalId,
        userId,
        stage: 'extract_requirements',
        status: 'partial',
        error: insertErr.message,
      });
    }
    requirementCount = count ?? rows.length;
  }

  await setStatus(sb, proposalId, 'idle', 50);
  return { intakeDocId: intakeDoc.id, requirementCount };
}

// ---------------------------------------------------------------------
// Stage 2: Draft — generate each requested section (Sonnet tier),
// persist structured content back into `proposals`.
// ---------------------------------------------------------------------
const DEFAULT_SECTIONS: NonNullable<DraftRequest['sections']> = [
  'problem_statement',
  'objectives',
  'proposed_approach',
  'deliverables',
  'team_composition',
  'schedule',
  'commercial_model',
  'assumptions',
  'risks',
  'win_themes',
  'compliance_matrix',
];

export async function runDraft(
  sb: SupabaseClient,
  proposalId: string,
  userId: string,
  req: DraftRequest,
): Promise<{ sectionsDrafted: number }> {
  await setStatus(sb, proposalId, 'drafting', 55);

  const sections = req.sections ?? DEFAULT_SECTIONS;

  const { data: proposal } = await sb
    .from('proposals')
    .select('*')
    .eq('id', proposalId)
    .single();
  const { data: requirements } = await sb
    .from('proposal_requirements')
    .select('*')
    .eq('proposal_id', proposalId);

  if (!proposal) {
    await setStatus(sb, proposalId, 'failed', 55, 'Proposal not found');
    return { sectionsDrafted: 0 };
  }

  // Fetch matching section templates for the user's persona if one is active.
  const { data: templates } = await sb
    .from('proposal_section_templates')
    .select('section_key, body_markdown, persona_code')
    .eq('is_active', true);

  const mergedProposal: Proposal = { ...(proposal as Proposal), ...(req.overrides ?? {}) };

  const context = {
    client_org: mergedProposal.client_org,
    rfp_reference: mergedProposal.rfp_reference,
    problem_statement: mergedProposal.problem_statement,
    objectives: mergedProposal.objectives,
    commercial_model: mergedProposal.commercial_model,
    recommended_frameworks: mergedProposal.recommended_frameworks,
    requirements: requirements ?? [],
  };

  const updatePatch: Record<string, unknown> = {};
  let drafted = 0;
  const totalTokens = { value: proposal.total_tokens_used ?? 0 };
  const tierPreference = req.force_tier ?? 'sonnet';
  const progressStep = 35 / sections.length;
  let progress = 55;

  for (const sectionKey of sections) {
    const template = templates?.find((t) => t.section_key === sectionKey)?.body_markdown;
    try {
      const { result, model, tier, usedFallback } = await completeWithFallback({
        system: DRAFT_SECTION_SYSTEM,
        user: DRAFT_SECTION_USER(sectionKey, context, template),
        preferredTier: tierPreference,
        maxTokens: 2500,
      });
      updatePatch[sectionKey === 'problem_statement' ? 'problem_statement' : sectionKey] =
        sectionKey === 'problem_statement' ? result.text.trim() : { markdown: result.text };
      totalTokens.value += result.total_tokens;
      drafted++;
      await logRun(sb, {
        proposalId,
        userId,
        stage: `draft_${sectionKey}`,
        model,
        tier,
        result,
        status: usedFallback ? 'fallback' : 'success',
        preview: result.text,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await logRun(sb, {
        proposalId,
        userId,
        stage: `draft_${sectionKey}`,
        status: 'failed',
        error: msg,
      });
    }
    progress = Math.min(90, Math.round(progress + progressStep));
    await setStatus(sb, proposalId, 'drafting', progress);
  }

  await sb
    .from('proposals')
    .update({ ...updatePatch, total_tokens_used: totalTokens.value })
    .eq('id', proposalId);

  await setStatus(sb, proposalId, 'idle', 90);
  return { sectionsDrafted: drafted };
}

// ---------------------------------------------------------------------
// Stage 3: Render — delegates to the proposal-render Edge Function which
// holds the docx/xlsx/pptx/pdf builders (Deno + the Python skill-based
// builders, wrapped in Edge Function via Deno subprocess is not viable;
// we instead call a Node side-car). This function just queues rows in
// proposal_outputs and invokes the function.
// ---------------------------------------------------------------------
export async function runRender(
  sb: SupabaseClient,
  proposalId: string,
  userId: string,
  req: RenderRequest,
): Promise<{ queued: number }> {
  await setStatus(sb, proposalId, 'rendering', 92);

  const kinds = req.kinds ?? ['full_proposal'];
  const rows = req.formats.flatMap((format) =>
    kinds.map((kind) => ({
      proposal_id: proposalId,
      user_id: userId,
      output_format: format,
      output_kind: kind,
      template_used: req.template_pack ?? 'veritasiq_default',
      render_status: 'queued' as const,
    })),
  );

  const { data: queued, error } = await sb
    .from('proposal_outputs')
    .insert(rows)
    .select('id, output_format, output_kind');

  if (error) {
    await setStatus(sb, proposalId, 'failed', 92, error.message);
    throw error;
  }

  // Fire-and-forget the render edge function — it will mark each row ready.
  await sb.functions.invoke('proposal-render', {
    body: { proposal_id: proposalId, output_ids: queued?.map((r) => r.id) ?? [] },
  });

  await setStatus(sb, proposalId, 'ready', 100);
  return { queued: queued?.length ?? 0 };
}
