-- M084: Engagement Manager foundation for CONSULTING_HUB
-- Adds consulting engagement progression schema, framework library,
-- soft-delete alignment, and email-correlation scaffolding.

-- -----------------------------------------------------------------------------
-- 1) Extend consulting_engagements for project-level lifecycle + correlation
-- -----------------------------------------------------------------------------
alter table if exists public.consulting_engagements
  add column if not exists title text,
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists current_step integer not null default 1,
  add column if not exists linked_email_ids uuid[] not null default '{}'::uuid[],
  add column if not exists correlation_confidence numeric(4,3),
  add column if not exists correlation_reasoning text,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz default now();

update public.consulting_engagements
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

-- Expand legacy status check to include archived.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.consulting_engagements'::regclass
      and conname = 'consulting_engagements_status_check'
  ) then
    alter table public.consulting_engagements
      drop constraint consulting_engagements_status_check;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.consulting_engagements'::regclass
      and conname = 'consulting_engagements_status_check'
  ) then
    alter table public.consulting_engagements
      add constraint consulting_engagements_status_check
      check (status in ('active','proposal','on_hold','completed','cancelled','archived'));
  end if;
exception
  when undefined_table then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.consulting_engagements'::regclass
      and conname = 'consulting_engagements_current_step_check'
  ) then
    alter table public.consulting_engagements
      add constraint consulting_engagements_current_step_check
      check (current_step between 1 and 7);
  end if;
exception
  when undefined_table then null;
end $$;

create index if not exists idx_consulting_engagements_project_id on public.consulting_engagements(project_id);
create index if not exists idx_consulting_engagements_status_updated on public.consulting_engagements(status, updated_at desc);

-- -----------------------------------------------------------------------------
-- 2) Framework library for 7-step consulting flow
-- -----------------------------------------------------------------------------
create table if not exists public.framework_library (
  code text primary key,
  name text not null,
  step_number integer not null check (step_number between 1 and 7),
  description text not null,
  usage_prompt text,
  active boolean not null default true,
  persona_tags text[] not null default array['CONSULTANT']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_framework_library_step_active on public.framework_library(step_number, active);

-- -----------------------------------------------------------------------------
-- 3) Engagement progression entities
-- -----------------------------------------------------------------------------
create table if not exists public.engagement_steps (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.consulting_engagements(id) on delete cascade,
  step_number integer not null check (step_number between 1 and 7),
  gate_status text not null default 'pending' check (gate_status in ('pending','passed','failed')),
  confidence_score numeric(4,3),
  artefacts jsonb not null default '{}'::jsonb,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engagement_id, step_number)
);

create table if not exists public.engagement_frameworks (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.consulting_engagements(id) on delete cascade,
  step_number integer not null check (step_number between 1 and 7),
  framework_code text not null references public.framework_library(code),
  output jsonb not null default '{}'::jsonb,
  model_used text,
  confidence_score numeric(4,3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.engagement_deliverables (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.consulting_engagements(id) on delete cascade,
  deliverable_type text not null check (deliverable_type in ('markdown','html','pptx','json','notes')),
  title text,
  content text,
  metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_engagement_steps_engagement on public.engagement_steps(engagement_id, step_number);
create index if not exists idx_engagement_frameworks_engagement on public.engagement_frameworks(engagement_id, step_number);
create index if not exists idx_engagement_deliverables_engagement on public.engagement_deliverables(engagement_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 4) Updated-at trigger helper reuse
-- -----------------------------------------------------------------------------
create or replace function public.pios_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_consulting_engagements_updated_at on public.consulting_engagements;
create trigger trg_consulting_engagements_updated_at
before update on public.consulting_engagements
for each row execute function public.pios_set_updated_at();

drop trigger if exists trg_framework_library_updated_at on public.framework_library;
create trigger trg_framework_library_updated_at
before update on public.framework_library
for each row execute function public.pios_set_updated_at();

drop trigger if exists trg_engagement_steps_updated_at on public.engagement_steps;
create trigger trg_engagement_steps_updated_at
before update on public.engagement_steps
for each row execute function public.pios_set_updated_at();

drop trigger if exists trg_engagement_frameworks_updated_at on public.engagement_frameworks;
create trigger trg_engagement_frameworks_updated_at
before update on public.engagement_frameworks
for each row execute function public.pios_set_updated_at();

drop trigger if exists trg_engagement_deliverables_updated_at on public.engagement_deliverables;
create trigger trg_engagement_deliverables_updated_at
before update on public.engagement_deliverables
for each row execute function public.pios_set_updated_at();

-- -----------------------------------------------------------------------------
-- 5) RLS for new tables (owner via engagement)
-- -----------------------------------------------------------------------------
alter table public.framework_library enable row level security;
alter table public.engagement_steps enable row level security;
alter table public.engagement_frameworks enable row level security;
alter table public.engagement_deliverables enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'framework_library' and policyname = 'framework_library_select_authenticated'
  ) then
    create policy framework_library_select_authenticated
      on public.framework_library
      for select
      using (auth.role() = 'authenticated' and active = true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'engagement_steps' and policyname = 'engagement_steps_owner_via_engagement'
  ) then
    create policy engagement_steps_owner_via_engagement
      on public.engagement_steps
      for all
      using (
        exists (
          select 1 from public.consulting_engagements ce
          where ce.id = engagement_steps.engagement_id and ce.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.consulting_engagements ce
          where ce.id = engagement_steps.engagement_id and ce.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'engagement_frameworks' and policyname = 'engagement_frameworks_owner_via_engagement'
  ) then
    create policy engagement_frameworks_owner_via_engagement
      on public.engagement_frameworks
      for all
      using (
        exists (
          select 1 from public.consulting_engagements ce
          where ce.id = engagement_frameworks.engagement_id and ce.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.consulting_engagements ce
          where ce.id = engagement_frameworks.engagement_id and ce.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'engagement_deliverables' and policyname = 'engagement_deliverables_owner_via_engagement'
  ) then
    create policy engagement_deliverables_owner_via_engagement
      on public.engagement_deliverables
      for all
      using (
        exists (
          select 1 from public.consulting_engagements ce
          where ce.id = engagement_deliverables.engagement_id and ce.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.consulting_engagements ce
          where ce.id = engagement_deliverables.engagement_id and ce.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 6) Email correlation scaffold: suggest + link hooks
-- -----------------------------------------------------------------------------
create or replace function public.suggest_linked_emails(
  p_user_id uuid,
  p_client_name text,
  p_limit integer default 10
)
returns table (
  email_id uuid,
  subject text,
  sender_name text,
  sender_email text,
  received_at timestamptz,
  match_score numeric
)
language sql
stable
as $$
  select
    ei.id as email_id,
    ei.subject,
    coalesce(ei.sender_name, ei.sender_email) as sender_name,
    ei.sender_email as sender_email,
    ei.received_at,
    (
      case when coalesce(ei.sender_name, '') ilike '%' || coalesce(p_client_name, '') || '%' then 0.55 else 0 end +
      case when coalesce(ei.subject, '') ilike '%' || coalesce(p_client_name, '') || '%' then 0.45 else 0 end
    )::numeric as match_score
  from public.email_items ei
  where ei.user_id = p_user_id
    and coalesce(trim(p_client_name), '') <> ''
    and (
      coalesce(ei.sender_name, '') ilike '%' || p_client_name || '%'
      or coalesce(ei.subject, '') ilike '%' || p_client_name || '%'
      or coalesce(ei.sender_email, '') ilike '%' || p_client_name || '%'
    )
  order by match_score desc, ei.received_at desc
  limit greatest(coalesce(p_limit, 10), 1);
$$;

create or replace function public.correlate_engagement_emails(
  p_engagement_id uuid,
  p_user_id uuid,
  p_limit integer default 5
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_client_name text;
  v_email_ids uuid[];
  v_confidence numeric;
begin
  select client_name into v_client_name
  from public.consulting_engagements
  where id = p_engagement_id and user_id = p_user_id;

  if v_client_name is null then
    return jsonb_build_object('linked', false, 'reason', 'engagement_not_found');
  end if;

  select
    coalesce(array_agg(s.email_id), '{}'::uuid[]),
    coalesce(max(s.match_score), 0)
  into v_email_ids, v_confidence
  from public.suggest_linked_emails(p_user_id, v_client_name, p_limit) s;

  update public.consulting_engagements
  set
    linked_email_ids = v_email_ids,
    correlation_confidence = v_confidence,
    correlation_reasoning = format('Matched on client name "%s" in sender/subject.', v_client_name),
    updated_at = now()
  where id = p_engagement_id and user_id = p_user_id;

  return jsonb_build_object(
    'linked', true,
    'linked_email_ids', v_email_ids,
    'confidence', v_confidence,
    'match_basis', 'client_name_sender_subject'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 7) Calibration gate evaluator scaffold
-- -----------------------------------------------------------------------------
create or replace function public.evaluate_calibration_gates(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_row record;
  v_cv_gate boolean;
begin
  select user_id, seniority_level, primary_industry
  into v_row
  from public.nemoclaw_calibration
  where user_id = p_user_id;

  v_cv_gate := v_row.user_id is not null
    and coalesce(v_row.seniority_level, '') <> ''
    and coalesce(v_row.primary_industry, '') <> '';

  return jsonb_build_object(
    'user_id', p_user_id,
    'cv_gate', v_cv_gate,
    'evaluated_at', now()
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8) Seed baseline active framework library entries (idempotent)
-- -----------------------------------------------------------------------------
insert into public.framework_library (code, name, step_number, description, usage_prompt, active, persona_tags)
values
  ('SMART', 'SMART Goal Setter', 1, 'Convert broad asks into specific, measurable problem statements.', 'Generate a SMART problem statement from the engagement brief.', true, array['CONSULTANT','CEO','EXECUTIVE']),
  ('STAKEHOLDER_ATLAS', 'Stakeholder Power Atlas™', 1, 'Map stakeholder influence and engagement approach.', 'Map stakeholders by power and interest, and suggest engagement moves.', true, array['CONSULTANT','EXECUTIVE']),
  ('SCOPE_CANVAS', 'Scope & Constraints Canvas', 1, 'Define scope boundaries and constraints before analysis.', 'Clarify in-scope/out-of-scope and list hard constraints.', true, array['CONSULTANT']),
  ('ISSUE_TREE', 'Issue Tree Builder', 2, 'Break the core question into MECE branches.', 'Create a MECE issue tree with 2-3 levels.', true, array['CONSULTANT']),
  ('MECE_VALIDATOR', 'MECE Validator', 2, 'Validate overlaps/gaps in problem structure.', 'Check whether the issue tree is mutually exclusive and collectively exhaustive.', true, array['CONSULTANT']),
  ('POM', 'Portfolio Opportunity Matrix™', 2, 'Prioritize portfolio opportunities by attractiveness and strength.', 'Apply POM to classify opportunities and recommend investment direction.', true, array['CONSULTANT','CEO']),
  ('IMPACT_EFFORT', '2x2 Impact/Effort Matrix', 3, 'Rank issues by value and delivery effort.', 'Score issues and classify into quick wins/major projects/low value.', true, array['CONSULTANT']),
  ('FEASIBILITY', 'Feasibility Matrix', 3, 'Evaluate execution feasibility with timeline/resource constraints.', 'Rate initiatives for timeline, resource, and political feasibility.', true, array['CONSULTANT']),
  ('RACI', 'RACI Matrix', 4, 'Assign execution accountability and decision rights.', 'Generate a RACI matrix for key tasks and decisions.', true, array['CONSULTANT','EXECUTIVE']),
  ('RTE', 'Risk-Tiered Escalation™', 4, 'Map escalation paths by risk severity and velocity.', 'Define escalation tiers and triggers for identified risks.', true, array['CONSULTANT','EXECUTIVE']),
  ('HYPOTHESIS_TESTING', 'Hypothesis Testing', 5, 'Design evidence plans to validate key assumptions.', 'Turn hypotheses into test plans and required data points.', true, array['CONSULTANT']),
  ('CVDM', 'Change Velocity & Direction Model™', 5, 'Sequence change and adoption momentum across stakeholders.', 'Assess urgency, coalition, quick wins, and resistance handling.', true, array['CONSULTANT']),
  ('PYRAMID', 'Pyramid Principle', 6, 'Synthesize findings into conclusion-first narrative.', 'Structure findings as conclusion, arguments, evidence.', true, array['CONSULTANT','EXECUTIVE']),
  ('SDL', 'Strategic Dialogue Layer™', 6, 'Frame executive messaging with logic and clarity.', 'Draft communication in Situation-Complication-Question-Answer format.', true, array['CONSULTANT','CEO']),
  ('ADF', 'Adaptive Delivery Framework™', 7, 'Translate recommendations into sprintable roadmap.', 'Generate implementation roadmap with milestones, owners, and metrics.', true, array['CONSULTANT','EXECUTIVE'])
on conflict (code) do update
set
  name = excluded.name,
  step_number = excluded.step_number,
  description = excluded.description,
  usage_prompt = excluded.usage_prompt,
  active = excluded.active,
  persona_tags = excluded.persona_tags,
  updated_at = now();
