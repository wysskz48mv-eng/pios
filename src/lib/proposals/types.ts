/**
 * PIOS Consulting Proposal — M115 type contracts
 *
 * These mirror the database schema (proposals, proposal_intake_documents,
 * proposal_requirements, proposal_outputs, proposal_ai_runs,
 * proposal_section_templates) and the JSON shapes exchanged between the
 * API routes, the Edge Functions, and the UI.
 */

export type IntakeMode =
  | 'manual'
  | 'rfp_upload'
  | 'email'
  | 'url'
  | 'dictation';

export type GenerationStatus =
  | 'idle'
  | 'ingesting'
  | 'analysing'
  | 'drafting'
  | 'rendering'
  | 'ready'
  | 'failed';

export type OutputFormat = 'docx' | 'pdf' | 'pptx' | 'xlsx' | 'md' | 'html';

export type OutputKind =
  | 'full_proposal'
  | 'executive_summary'
  | 'pitch_deck'
  | 'commercial_schedule'
  | 'compliance_matrix'
  | 'schedule_gantt'
  | 'cover_letter';

export type RequirementType =
  | 'problem'
  | 'objective'
  | 'deliverable'
  | 'scope'
  | 'out_of_scope'
  | 'evaluation_criterion'
  | 'constraint'
  | 'deadline'
  | 'budget_signal'
  | 'compliance'
  | 'mandatory'
  | 'desirable'
  | 'question';

export type ResponseStatus =
  | 'unaddressed'
  | 'drafted'
  | 'confirmed'
  | 'gap';

export type Priority = 'mandatory' | 'high' | 'medium' | 'low' | 'nice_to_have';

export interface ClientContact {
  name?: string;
  role?: string;
  email?: string;
  phone?: string;
  organisation?: string;
}

export interface Deliverable {
  title: string;
  description: string;
  week?: number;
  owner?: string;
  acceptance_criteria?: string;
}

export interface TeamMember {
  name: string;
  role: string;
  bio_snippet?: string;
  allocation_pct?: number;
}

export interface SchedulePhase {
  phase_no: number;
  phase_name: string;
  phase_description: string;
  start_week: number;
  end_week: number;
  key_activities: string[];
}

export interface CommercialModel {
  basis: 'time_and_materials' | 'fixed_fee' | 'outcome_based' | 'retainer';
  currency: string;
  day_rate?: number;
  estimated_days?: number;
  fee_total?: number;
  payment_schedule?: string;
  expenses_policy?: string;
}

export interface Risk {
  risk: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

export interface FrameworkRecommendation {
  framework_code: string;
  name: string;
  rationale: string;
  confidence: number;
}

export interface ComplianceMatrixItem {
  requirement_id: string;
  requirement_title: string;
  our_response: string;
  response_status: ResponseStatus;
  page_ref?: string;
}

/** The canonical shape of a proposal row plus generated content. */
export interface Proposal {
  id: string;
  user_id: string;
  tenant_id: string | null;
  engagement_id: string | null;
  title: string;
  rfp_reference: string | null;
  client_org: string | null;
  client_contact: ClientContact;
  submission_due_at: string | null;

  intake_mode: IntakeMode;
  problem_statement: string | null;
  objectives: string[];
  proposed_approach: { summary?: string; pillars?: string[] };
  methodology: Record<string, unknown>;
  deliverables: Deliverable[];
  team_composition: TeamMember[];
  schedule: SchedulePhase[];
  commercial_model: CommercialModel;
  assumptions: string[];
  risks: Risk[];
  case_studies: Array<{ title: string; summary: string }>;
  recommended_frameworks: FrameworkRecommendation[];
  win_themes: string[];
  compliance_matrix: ComplianceMatrixItem[];

  generation_status: GenerationStatus;
  generation_progress: number;
  generation_error: string | null;
  ai_confidence: number | null;
  last_ai_run_at: string | null;
  total_tokens_used: number;
  version: number;

  // legacy flat fields kept for back-compat with existing NemoClaw UI
  fee_gbp: number | null;
  day_rate: number | null;
  estimated_days: number | null;
  currency: string | null;
  status: string | null;
  content_md: string | null;
  scope_bullets: string[] | null;

  created_at: string;
  updated_at: string;
}

export interface ProposalIntakeDocument {
  id: string;
  proposal_id: string;
  user_id: string;
  source_type: 'rfp' | 'brief' | 'email' | 'url' | 'transcript' | 'other';
  file_item_id: string | null;
  original_filename: string | null;
  storage_path: string | null;
  source_url: string | null;
  extracted_text: string | null;
  text_length: number | null;
  language: string;
  extraction_status: 'pending' | 'extracting' | 'complete' | 'failed';
  extraction_error: string | null;
  extracted_at: string | null;
  created_at: string;
}

export interface ProposalRequirement {
  id: string;
  proposal_id: string;
  intake_doc_id: string | null;
  user_id: string;
  requirement_type: RequirementType;
  title: string;
  detail: string | null;
  source_quote: string | null;
  source_page: string | null;
  priority: Priority;
  our_response: string | null;
  response_status: ResponseStatus;
  confidence: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProposalOutput {
  id: string;
  proposal_id: string;
  output_format: OutputFormat;
  output_kind: OutputKind;
  version: number;
  storage_path: string | null;
  public_url: string | null;
  file_size: number | null;
  page_count: number | null;
  template_used: string | null;
  render_status: 'queued' | 'rendering' | 'ready' | 'failed';
  render_error: string | null;
  rendered_at: string | null;
  checksum_sha256: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ProposalAiRun {
  id: string;
  proposal_id: string;
  stage: string;
  model: string | null;
  tier: 'haiku' | 'sonnet' | 'opus' | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  status: 'success' | 'partial' | 'failed' | 'rate_limited' | 'fallback';
  error_message: string | null;
  output_preview: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Request body for POST /api/proposals/[id]/ingest */
export interface IngestRequest {
  source_type: ProposalIntakeDocument['source_type'];
  file_item_id?: string;
  source_url?: string;
  raw_text?: string;
  language?: string;
}

/** Request body for POST /api/proposals/[id]/draft */
export interface DraftRequest {
  sections?: Array<
    | 'problem_statement'
    | 'objectives'
    | 'proposed_approach'
    | 'methodology'
    | 'deliverables'
    | 'team_composition'
    | 'schedule'
    | 'commercial_model'
    | 'assumptions'
    | 'risks'
    | 'win_themes'
    | 'compliance_matrix'
  >;
  /** Optional human edits to merge in before re-drafting */
  overrides?: Partial<Proposal>;
  /** Force a model tier; otherwise Haiku-first with Sonnet fallback. */
  force_tier?: 'haiku' | 'sonnet';
}

/** Request body for POST /api/proposals/[id]/render */
export interface RenderRequest {
  formats: OutputFormat[];
  kinds?: OutputKind[];
  template_pack?: string;
}
