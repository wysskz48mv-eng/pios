-- M085: FM Consultant module (Phase 4)
-- Adds FM engagement taxonomy, risk library, engagement risk register,
-- options framework outputs, precedent search, and 5-phase lifecycle support.

-- -----------------------------------------------------------------------------
-- 0) Reusable updated_at trigger helper (already created in M084; keep idempotent)
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

-- -----------------------------------------------------------------------------
-- 1) FM engagement type registry
-- -----------------------------------------------------------------------------
create table if not exists public.fm_engagement_types (
  id uuid primary key default gen_random_uuid(),
  type_code text not null unique,
  type_number integer not null check (type_number between 1 and 9),
  name text not null,
  description text not null,
  wave integer not null check (wave between 1 and 3),
  recommended_frameworks jsonb not null default '{}'::jsonb,
  iso_standards text[] not null default '{}'::text[],
  regulatory_refs text[] not null default '{}'::text[],
  typical_duration_weeks integer,
  complexity_level text check (complexity_level in ('low','medium','high')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fm_engagement_types_wave on public.fm_engagement_types(wave, is_active);

-- -----------------------------------------------------------------------------
-- 2) FM risk library
-- -----------------------------------------------------------------------------
create table if not exists public.fm_risk_library (
  id uuid primary key default gen_random_uuid(),
  risk_code text not null unique,
  category text not null check (category in ('operational','financial','compliance','health_safety','strategic')),
  title text not null,
  description text not null,
  typical_probability text check (typical_probability in ('low','medium','high')),
  typical_impact text check (typical_impact in ('low','medium','high')),
  recommended_mitigations text[] not null default '{}'::text[],
  iso_references text[] not null default '{}'::text[],
  engagement_types text[] not null default '{}'::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fm_risk_library_category on public.fm_risk_library(category);
create index if not exists idx_fm_risk_library_engagement_types on public.fm_risk_library using gin(engagement_types);
create index if not exists idx_fm_risk_library_search on public.fm_risk_library using gin(to_tsvector('english', risk_code || ' ' || title || ' ' || description));

-- -----------------------------------------------------------------------------
-- 3) Extend consulting engagements for FM metadata + universal 5-phase workflow
-- -----------------------------------------------------------------------------
alter table if exists public.consulting_engagements
  add column if not exists fm_engagement_type_code text,
  add column if not exists industry_sector text,
  add column if not exists building_type text,
  add column if not exists project_scale text,
  add column if not exists current_phase text not null default 'setup',
  add column if not exists phase_gate_state jsonb not null default '{"setup": false, "execution": false, "reporting": false, "soft_landing": false, "closeout": false}'::jsonb;

alter table if exists public.consulting_engagements
  drop constraint if exists consulting_engagements_current_phase_check;

alter table if exists public.consulting_engagements
  add constraint consulting_engagements_current_phase_check
  check (current_phase in ('setup','execution','reporting','soft_landing','closeout'));

alter table if exists public.consulting_engagements
  drop constraint if exists consulting_engagements_fm_engagement_type_code_fkey;

alter table if exists public.consulting_engagements
  add constraint consulting_engagements_fm_engagement_type_code_fkey
  foreign key (fm_engagement_type_code)
  references public.fm_engagement_types(type_code)
  on delete set null;

create index if not exists idx_consulting_engagements_fm_type on public.consulting_engagements(fm_engagement_type_code);
create index if not exists idx_consulting_engagements_current_phase on public.consulting_engagements(current_phase);

-- -----------------------------------------------------------------------------
-- 4) Engagement-level FM risks
-- -----------------------------------------------------------------------------
create table if not exists public.engagement_risks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  engagement_id uuid not null references public.consulting_engagements(id) on delete cascade,
  risk_library_id uuid references public.fm_risk_library(id) on delete set null,
  custom_title text,
  custom_description text,
  probability text not null check (probability in ('low','medium','high')),
  impact text not null check (impact in ('low','medium','high')),
  risk_score integer generated always as (
    case
      when probability = 'low' and impact = 'low' then 1
      when probability = 'low' and impact = 'medium' then 2
      when probability = 'low' and impact = 'high' then 3
      when probability = 'medium' and impact = 'low' then 2
      when probability = 'medium' and impact = 'medium' then 4
      when probability = 'medium' and impact = 'high' then 6
      when probability = 'high' and impact = 'low' then 3
      when probability = 'high' and impact = 'medium' then 6
      when probability = 'high' and impact = 'high' then 9
    end
  ) stored,
  mitigation_plan text,
  mitigation_status text not null default 'open' check (mitigation_status in ('open','mitigating','mitigated','accepted')),
  owner_user_id uuid references auth.users(id) on delete set null,
  identified_date date not null default current_date,
  target_closure_date date,
  actual_closure_date date,
  linked_email_ids uuid[] not null default '{}'::uuid[],
  evidence_document_ids uuid[] not null default '{}'::uuid[],
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (risk_library_id is not null or custom_title is not null)
);

create index if not exists idx_engagement_risks_engagement on public.engagement_risks(engagement_id);
create index if not exists idx_engagement_risks_score on public.engagement_risks(risk_score desc);
create index if not exists idx_engagement_risks_status on public.engagement_risks(mitigation_status);

-- -----------------------------------------------------------------------------
-- 5) FM options framework outputs
-- -----------------------------------------------------------------------------
create table if not exists public.fm_options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  engagement_id uuid not null references public.consulting_engagements(id) on delete cascade,
  option_number integer not null,
  title text not null,
  description text not null,
  pros text[] not null default '{}'::text[],
  cons text[] not null default '{}'::text[],
  estimated_cost_min numeric,
  estimated_cost_max numeric,
  cost_currency text not null default 'GBP',
  implementation_time_weeks integer,
  risk_level text check (risk_level in ('low','medium','high')),
  is_recommended boolean not null default false,
  recommendation_reasoning text,
  linked_project_budget numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engagement_id, option_number)
);

create index if not exists idx_fm_options_engagement on public.fm_options(engagement_id);

-- -----------------------------------------------------------------------------
-- 6) FM precedents (anonymized)
-- -----------------------------------------------------------------------------
create table if not exists public.fm_precedents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  engagement_type text not null,
  industry_sector text,
  building_type text,
  project_scale text,
  anonymized_excerpt text,
  tags text[] not null default '{}'::text[],
  frameworks_used text[] not null default '{}'::text[],
  reusable_artifacts jsonb not null default '{}'::jsonb,
  original_engagement_id uuid references public.consulting_engagements(id) on delete set null,
  created_from_engagement_at timestamptz,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fm_precedents_type on public.fm_precedents(engagement_type);
create index if not exists idx_fm_precedents_tags on public.fm_precedents using gin(tags);
create index if not exists idx_fm_precedents_search on public.fm_precedents using gin(to_tsvector('english', title || ' ' || coalesce(anonymized_excerpt, '')));

-- -----------------------------------------------------------------------------
-- 7) Engagement stakeholder links (contacts integration v1)
-- -----------------------------------------------------------------------------
create table if not exists public.engagement_stakeholders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  engagement_id uuid not null references public.consulting_engagements(id) on delete cascade,
  stakeholder_id uuid not null,
  engagement_role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engagement_id, stakeholder_id)
);

create index if not exists idx_engagement_stakeholders_engagement on public.engagement_stakeholders(engagement_id);

-- Add FK to stakeholders only where table exists in target environment.
do $$
begin
  if to_regclass('public.stakeholders') is not null then
    if not exists (
      select 1 from pg_constraint
      where conname = 'engagement_stakeholders_stakeholder_id_fkey'
        and conrelid = 'public.engagement_stakeholders'::regclass
    ) then
      alter table public.engagement_stakeholders
        add constraint engagement_stakeholders_stakeholder_id_fkey
        foreign key (stakeholder_id)
        references public.stakeholders(id)
        on delete cascade;
    end if;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 8) Ensure deliverables support pdf format
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'engagement_deliverables_deliverable_type_check'
      and conrelid = 'public.engagement_deliverables'::regclass
  ) then
    alter table public.engagement_deliverables
      drop constraint engagement_deliverables_deliverable_type_check;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'engagement_deliverables_deliverable_type_check'
      and conrelid = 'public.engagement_deliverables'::regclass
  ) then
    alter table public.engagement_deliverables
      add constraint engagement_deliverables_deliverable_type_check
      check (deliverable_type in ('markdown','html','pdf','pptx','json','notes'));
  end if;
exception
  when undefined_table then null;
end $$;

-- -----------------------------------------------------------------------------
-- 9) Updated-at triggers
-- -----------------------------------------------------------------------------
drop trigger if exists trg_fm_engagement_types_updated_at on public.fm_engagement_types;
create trigger trg_fm_engagement_types_updated_at
before update on public.fm_engagement_types
for each row execute function public.pios_set_updated_at();

drop trigger if exists trg_fm_risk_library_updated_at on public.fm_risk_library;
create trigger trg_fm_risk_library_updated_at
before update on public.fm_risk_library
for each row execute function public.pios_set_updated_at();

drop trigger if exists trg_engagement_risks_updated_at on public.engagement_risks;
create trigger trg_engagement_risks_updated_at
before update on public.engagement_risks
for each row execute function public.pios_set_updated_at();

drop trigger if exists trg_fm_options_updated_at on public.fm_options;
create trigger trg_fm_options_updated_at
before update on public.fm_options
for each row execute function public.pios_set_updated_at();

drop trigger if exists trg_fm_precedents_updated_at on public.fm_precedents;
create trigger trg_fm_precedents_updated_at
before update on public.fm_precedents
for each row execute function public.pios_set_updated_at();

drop trigger if exists trg_engagement_stakeholders_updated_at on public.engagement_stakeholders;
create trigger trg_engagement_stakeholders_updated_at
before update on public.engagement_stakeholders
for each row execute function public.pios_set_updated_at();

-- -----------------------------------------------------------------------------
-- 10) RLS
-- -----------------------------------------------------------------------------
alter table public.fm_engagement_types enable row level security;
alter table public.fm_risk_library enable row level security;
alter table public.engagement_risks enable row level security;
alter table public.fm_options enable row level security;
alter table public.fm_precedents enable row level security;
alter table public.engagement_stakeholders enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fm_engagement_types' and policyname = 'fm_engagement_types_select_authenticated'
  ) then
    create policy fm_engagement_types_select_authenticated
      on public.fm_engagement_types
      for select
      using (auth.role() = 'authenticated' and is_active = true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fm_risk_library' and policyname = 'fm_risk_library_select_authenticated'
  ) then
    create policy fm_risk_library_select_authenticated
      on public.fm_risk_library
      for select
      using (auth.role() = 'authenticated' and is_active = true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'engagement_risks' and policyname = 'engagement_risks_owner_via_engagement'
  ) then
    create policy engagement_risks_owner_via_engagement
      on public.engagement_risks
      for all
      using (
        auth.uid() = user_id
        and exists (
          select 1 from public.consulting_engagements ce
          where ce.id = engagement_risks.engagement_id and ce.user_id = auth.uid()
        )
      )
      with check (
        auth.uid() = user_id
        and exists (
          select 1 from public.consulting_engagements ce
          where ce.id = engagement_risks.engagement_id and ce.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fm_options' and policyname = 'fm_options_owner_via_engagement'
  ) then
    create policy fm_options_owner_via_engagement
      on public.fm_options
      for all
      using (
        auth.uid() = user_id
        and exists (
          select 1 from public.consulting_engagements ce
          where ce.id = fm_options.engagement_id and ce.user_id = auth.uid()
        )
      )
      with check (
        auth.uid() = user_id
        and exists (
          select 1 from public.consulting_engagements ce
          where ce.id = fm_options.engagement_id and ce.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fm_precedents' and policyname = 'fm_precedents_owner_or_public'
  ) then
    create policy fm_precedents_owner_or_public
      on public.fm_precedents
      for select
      using (is_public = true or auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fm_precedents' and policyname = 'fm_precedents_owner_write'
  ) then
    create policy fm_precedents_owner_write
      on public.fm_precedents
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'engagement_stakeholders' and policyname = 'engagement_stakeholders_owner_via_engagement'
  ) then
    create policy engagement_stakeholders_owner_via_engagement
      on public.engagement_stakeholders
      for all
      using (
        auth.uid() = user_id
        and exists (
          select 1 from public.consulting_engagements ce
          where ce.id = engagement_stakeholders.engagement_id and ce.user_id = auth.uid()
        )
      )
      with check (
        auth.uid() = user_id
        and exists (
          select 1 from public.consulting_engagements ce
          where ce.id = engagement_stakeholders.engagement_id and ce.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 11) Seed FM engagement types (Wave 1)
-- -----------------------------------------------------------------------------
insert into public.fm_engagement_types (
  type_code, type_number, name, description, wave, recommended_frameworks, iso_standards, regulatory_refs, typical_duration_weeks, complexity_level, is_active
)
values
  (
    'fm_type_1', 1, 'FM Strategy',
    'Strategic facilities management planning and roadmap development',
    1,
    '{"step_1": ["smart_goals", "stakeholder_analysis"], "step_2": ["issue_tree", "hypothesis_tree"], "step_4": ["raci_matrix", "gantt_timeline"], "step_5": ["value_chain"], "step_6": ["pyramid_principle"]}'::jsonb,
    array['ISO 41001', 'ISO 55001'],
    array['Building Safety Act 2022', 'RICS FM'],
    8,
    'high',
    true
  ),
  (
    'fm_type_2', 2, 'Cost Benchmarking',
    'FM cost analysis and benchmarking against industry standards',
    1,
    '{"step_3": ["pareto_80_20", "impact_effort_matrix"], "step_5": ["hypothesis_testing"]}'::jsonb,
    array['ISO 41001'],
    array['RICS FM'],
    4,
    'medium',
    true
  ),
  (
    'fm_type_3', 3, 'Audit & Compliance',
    'FM audit and regulatory compliance assessment',
    1,
    '{"step_2": ["mece_validator"], "step_4": ["risk_register"], "step_5": ["hypothesis_testing"]}'::jsonb,
    array['ISO 41001', 'ISO 19011', 'ISO 55001'],
    array['Building Safety Act 2022', 'Fire Safety Order'],
    6,
    'high',
    true
  ),
  (
    'fm_type_9', 9, 'RIBA Integration',
    'Building lifecycle FM integration (RIBA Stages 0-7)',
    1,
    '{"step_1": ["smart_goals", "scope_constraints"], "step_2": ["issue_tree"], "step_4": ["raci_matrix", "risk_register", "gantt_timeline"]}'::jsonb,
    array['ISO 41001', 'ISO 55001'],
    array['RIBA Plan of Work', 'Building Safety Act 2022'],
    12,
    'high',
    true
  )
on conflict (type_code) do update
set
  type_number = excluded.type_number,
  name = excluded.name,
  description = excluded.description,
  wave = excluded.wave,
  recommended_frameworks = excluded.recommended_frameworks,
  iso_standards = excluded.iso_standards,
  regulatory_refs = excluded.regulatory_refs,
  typical_duration_weeks = excluded.typical_duration_weeks,
  complexity_level = excluded.complexity_level,
  is_active = excluded.is_active,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- 12) Seed FM risk library (MVP set: FM-001..FM-050)
-- -----------------------------------------------------------------------------
insert into public.fm_risk_library (
  risk_code, category, title, description, typical_probability, typical_impact,
  recommended_mitigations, iso_references, engagement_types, is_active
)
values
-- Operational (15)
('FM-001','operational','Critical Service Disruption','Unexpected disruption to core building services (HVAC, power, water) impacting occupiers.','medium','high',array['Implement planned preventive maintenance','Establish redundancy for critical systems','Maintain 24/7 response SLAs'],array['ISO 41001','ISO 55001'],array['fm_type_1','fm_type_3','fm_type_9'],true),
('FM-002','operational','Unplanned Asset Failure','Major asset breakdown due to lifecycle neglect or poor condition monitoring.','medium','high',array['Deploy condition-based monitoring','Refresh lifecycle replacement plans','Track mean time between failures'],array['ISO 55001','ISO 41001'],array['fm_type_1','fm_type_2','fm_type_9'],true),
('FM-003','operational','Maintenance Backlog Growth','Reactive tickets exceed delivery capacity, creating escalating maintenance backlog.','high','medium',array['Prioritise backlog by criticality','Increase scheduled PPM windows','Add contractor surge capacity'],array['ISO 41001'],array['fm_type_1','fm_type_2'],true),
('FM-004','operational','Space Utilisation Inefficiency','Portfolio space is underused or misallocated versus operational need.','medium','medium',array['Run occupancy studies quarterly','Introduce dynamic workplace policies','Reconfigure low-utilisation areas'],array['ISO 41001'],array['fm_type_1','fm_type_2','fm_type_9'],true),
('FM-005','operational','Poor Helpdesk Resolution','Low first-time-fix rates and slow closure times degrade user satisfaction.','medium','medium',array['Implement triage standards','Publish SLA dashboards','Train frontline FM coordinators'],array['ISO 41001'],array['fm_type_1','fm_type_3'],true),
('FM-006','operational','Utilities Data Quality Gaps','Metering data is incomplete or inaccurate, reducing confidence in performance decisions.','medium','medium',array['Calibrate and validate metering estate','Automate anomaly detection','Define data ownership by site'],array['ISO 41001','ISO 55001'],array['fm_type_2','fm_type_9'],true),
('FM-007','operational','Cleaning Quality Degradation','Cleaning standards drop below contractual or user expectations.','medium','medium',array['Introduce quality audits','Tie KPIs to payment mechanisms','Increase peak-time inspections'],array['ISO 41001'],array['fm_type_2','fm_type_3'],true),
('FM-008','operational','Security Coverage Weakness','Inadequate guarding, access control, or monitoring creates operational vulnerability.','low','high',array['Review security post orders','Upgrade access-control zoning','Run incident response drills'],array['ISO 41001'],array['fm_type_1','fm_type_3','fm_type_9'],true),
('FM-009','operational','Supply Chain Delay','Spare parts or consumables arrive late, delaying essential maintenance tasks.','medium','medium',array['Maintain critical spares inventory','Dual-source key suppliers','Set expedited procurement routes'],array['ISO 55001'],array['fm_type_2','fm_type_9'],true),
('FM-010','operational','BMS Integration Failure','Building management systems are fragmented, limiting monitoring and control capability.','medium','high',array['Define BMS integration roadmap','Standardise protocols and tagging','Commission interoperability testing'],array['ISO 41001','ISO 55001'],array['fm_type_1','fm_type_9'],true),
('FM-011','operational','Vendor Workforce Shortage','Contractors fail to provide adequate qualified labour coverage.','medium','medium',array['Set minimum staffing clauses','Monitor staffing compliance monthly','Pre-qualify backup contractors'],array['ISO 41001'],array['fm_type_2','fm_type_3'],true),
('FM-012','operational','Contractor Performance Failure','Contractors consistently underperform against SLAs and quality targets.','high','high',array['Implement scorecard governance','Apply service credit regime','Trigger remediation plans with milestones'],array['ISO 41001','ISO 19011'],array['fm_type_2','fm_type_3','fm_type_9'],true),
('FM-013','operational','Inadequate Winter Preparedness','Lack of seasonal readiness causes outages and unsafe conditions during cold weather.','medium','medium',array['Run winterisation checklist','Pre-position emergency supplies','Complete seasonal drills'],array['ISO 41001'],array['fm_type_1','fm_type_9'],true),
('FM-014','operational','Waste Management Service Failure','Waste streams are not collected, segregated, or disposed in line with requirements.','medium','medium',array['Audit waste contractor compliance','Track waste segregation KPIs','Escalate missed collections within 24h'],array['ISO 41001'],array['fm_type_2','fm_type_3'],true),
('FM-015','operational','Business Continuity Plan Obsolescence','BCP documentation is outdated and not aligned to current occupancy or asset profile.','low','high',array['Refresh BCP annually','Run live scenario testing','Assign continuity plan owners'],array['ISO 41001','ISO 55001'],array['fm_type_1','fm_type_3','fm_type_9'],true),

-- Financial (10)
('FM-016','financial','Budget Overrun','Actual FM expenditure exceeds approved annual plan.','medium','high',array['Implement monthly variance review','Set cost-control thresholds','Pre-approve high-value spend'],array['ISO 41001'],array['fm_type_1','fm_type_2'],true),
('FM-017','financial','Cost Escalation in Utilities','Energy and utility costs rise faster than forecast assumptions.','high','medium',array['Lock in procurement contracts','Deploy energy efficiency programme','Track tariff exposure monthly'],array['ISO 41001'],array['fm_type_2','fm_type_9'],true),
('FM-018','financial','Hidden Lifecycle Costs','Deferred capex and lifecycle obligations are excluded from FM business cases.','medium','high',array['Model total cost of ownership','Include lifecycle reserve in budgets','Review asset condition annually'],array['ISO 55001'],array['fm_type_1','fm_type_2','fm_type_9'],true),
('FM-019','financial','Procurement Inefficiency','Fragmented procurement leads to poor pricing and duplicated vendor spend.','medium','medium',array['Centralise category management','Use framework agreements','Benchmark unit rates biannually'],array['ISO 41001'],array['fm_type_2'],true),
('FM-020','financial','Invoice Validation Leakage','Supplier invoices contain errors not detected before payment.','medium','medium',array['Automate 3-way matching','Audit high-value invoices','Enforce line-item evidence'],array['ISO 41001','ISO 19011'],array['fm_type_2','fm_type_3'],true),
('FM-021','financial','Contract Indexation Shock','Automatic index-linked uplifts materially increase contract values.','medium','medium',array['Cap indexation in renewals','Model inflation sensitivity','Negotiate productivity offsets'],array['ISO 41001'],array['fm_type_2','fm_type_9'],true),
('FM-022','financial','Cashflow Timing Risk','Payment schedules mismatch with budget release cycles and milestones.','low','medium',array['Align payment milestones to deliverables','Use cashflow forecast by quarter','Escalate deviation beyond threshold'],array['ISO 41001'],array['fm_type_1','fm_type_2'],true),
('FM-023','financial','Insurance Coverage Gap','Policy scope does not fully cover building, liability, or operational disruptions.','low','high',array['Review policy limits annually','Map cover to risk register','Track insurer recommendations'],array['ISO 41001'],array['fm_type_1','fm_type_3'],true),
('FM-024','financial','Poor Cost Allocation Transparency','Shared FM costs are not allocated fairly across departments or sites.','medium','medium',array['Define allocation rules','Publish chargeback methodology','Reconcile monthly against occupancy'],array['ISO 41001'],array['fm_type_2'],true),
('FM-025','financial','Capital Approval Delay','Critical FM upgrades are delayed due to slow capex approvals.','medium','high',array['Prepare business case templates','Pre-align approval forums','Stage-gate capex submissions'],array['ISO 55001'],array['fm_type_1','fm_type_9'],true),

-- Compliance (10)
('FM-026','compliance','Building Safety Act Non-Compliance','Failure to meet duties under Building Safety Act 2022 and related regulations.','medium','high',array['Assign accountable person responsibilities','Maintain safety case documentation','Schedule external compliance reviews'],array['ISO 41001','ISO 19011'],array['fm_type_3','fm_type_9'],true),
('FM-027','compliance','Fire Safety Documentation Gaps','Fire risk assessments and records are outdated or incomplete.','medium','high',array['Update FRA annually','Track remedial actions to closure','Audit evacuation plans per site'],array['ISO 41001','ISO 19011'],array['fm_type_3','fm_type_9'],true),
('FM-028','compliance','Health and Safety Legal Breach','Operational practices breach H&S legal obligations and standards.','low','high',array['Implement compliance checklist','Train site teams on legal duties','Perform monthly compliance audits'],array['ISO 41001','ISO 19011'],array['fm_type_3'],true),
('FM-029','compliance','EPC Expiry or Low Rating','Energy Performance Certificates lapse or fail minimum thresholds.','medium','medium',array['Track EPC expiry register','Prioritise efficiency upgrades','Engage accredited assessors early'],array['ISO 41001'],array['fm_type_2','fm_type_3','fm_type_9'],true),
('FM-030','compliance','Accessibility Standard Failure','Facilities fail to meet accessibility requirements and inclusive design obligations.','low','high',array['Run accessibility audits','Prioritise barrier-removal actions','Validate changes with user groups'],array['ISO 41001'],array['fm_type_3','fm_type_9'],true),
('FM-031','compliance','Water Hygiene Record Deficit','Legionella and water hygiene logs are incomplete or not auditable.','medium','high',array['Implement digital logbooks','Define sampling frequencies','Verify contractor competency'],array['ISO 41001','ISO 19011'],array['fm_type_3'],true),
('FM-032','compliance','Permit-to-Work Control Failure','PTW process is bypassed or poorly controlled for high-risk tasks.','medium','high',array['Digitise PTW workflows','Introduce supervisor sign-off','Audit permit compliance weekly'],array['ISO 41001'],array['fm_type_3','fm_type_9'],true),
('FM-033','compliance','Statutory Inspection Overdue','Mandatory inspections are missed due to poor planning or tracking.','medium','high',array['Maintain statutory planner','Escalate upcoming deadlines','Automate reminders and evidence capture'],array['ISO 41001','ISO 19011'],array['fm_type_3'],true),
('FM-034','compliance','Data Protection Non-Compliance','FM vendor processes expose personal data without sufficient controls.','low','medium',array['Review vendor DPAs','Implement access controls','Run annual privacy impact assessments'],array['ISO 41001'],array['fm_type_1','fm_type_3'],true),
('FM-035','compliance','Environmental Permit Breach','Waste, emissions, or discharge controls breach permit conditions.','low','high',array['Track permit obligations by site','Monitor environmental KPIs','Escalate exceedances within 24h'],array['ISO 41001'],array['fm_type_2','fm_type_3'],true),

-- Health & Safety (10)
('FM-036','health_safety','Asbestos Exposure Incident','Asbestos-containing materials are disturbed without proper controls.','low','high',array['Maintain asbestos register','Require intrusive work permits','Train contractors on asbestos awareness'],array['ISO 41001','ISO 19011'],array['fm_type_3','fm_type_9'],true),
('FM-037','health_safety','Legionella Outbreak Risk','Insufficient water hygiene management increases legionella exposure risk.','medium','high',array['Implement legionella monitoring regime','Validate flushing and sampling records','Escalate abnormal lab results immediately'],array['ISO 41001','ISO 19011'],array['fm_type_3'],true),
('FM-038','health_safety','Electrical Safety Non-Conformance','Defects in electrical systems create shock, fire, or outage risk.','medium','high',array['Maintain EICR programme','Close remedial works to deadline','Enforce lockout-tagout protocols'],array['ISO 41001','ISO 55001'],array['fm_type_3','fm_type_9'],true),
('FM-039','health_safety','Emergency Egress Obstruction','Escape routes are blocked or inadequately signed during operations.','medium','high',array['Inspect egress routes daily','Update signage and lighting','Run evacuation drills quarterly'],array['ISO 41001'],array['fm_type_3','fm_type_9'],true),
('FM-040','health_safety','Slip Trip Fall Hotspots','Repeated slip/trip incidents in common areas due to poor controls.','high','medium',array['Map incident hotspots','Increase housekeeping checks','Install anti-slip treatments'],array['ISO 41001'],array['fm_type_2','fm_type_3'],true),
('FM-041','health_safety','Manual Handling Injury Risk','Poor handling practices lead to musculoskeletal injury incidents.','medium','medium',array['Deliver manual handling training','Provide suitable lifting aids','Review high-risk tasks monthly'],array['ISO 41001'],array['fm_type_2','fm_type_3'],true),
('FM-042','health_safety','Indoor Air Quality Deterioration','Ventilation and filtration are insufficient for occupant health and comfort.','medium','medium',array['Measure IAQ indicators regularly','Upgrade filtration strategy','Balance HVAC systems seasonally'],array['ISO 41001','ISO 55001'],array['fm_type_1','fm_type_9'],true),
('FM-043','health_safety','High-Risk Contractor Incident','Third-party contractors create safety incidents during maintenance works.','medium','high',array['Strengthen contractor induction','Enforce RAMS approval','Increase supervisor presence for high-risk works'],array['ISO 41001','ISO 19011'],array['fm_type_3','fm_type_9'],true),
('FM-044','health_safety','Workplace Violence Event','Security incidents expose staff or visitors to violence risks.','low','high',array['Implement incident escalation protocol','Train staff in de-escalation','Coordinate with local security services'],array['ISO 41001'],array['fm_type_1','fm_type_3'],true),
('FM-045','health_safety','Pandemic Response Preparedness Gap','FM response plans are inadequate for infectious disease outbreaks.','low','high',array['Maintain infectious disease playbook','Stock critical PPE and cleaning supplies','Define occupancy response triggers'],array['ISO 41001'],array['fm_type_1','fm_type_9'],true),

-- Strategic (5)
('FM-046','strategic','FM Strategy Misalignment','FM operating model is not aligned with business goals and growth plans.','medium','high',array['Refresh FM strategy annually','Link FM KPIs to enterprise objectives','Embed executive governance forum'],array['ISO 41001','ISO 55001'],array['fm_type_1','fm_type_9'],true),
('FM-047','strategic','Change Management Failure','Transformation initiatives stall due to weak adoption and communication.','medium','medium',array['Define change plan by stakeholder group','Track adoption metrics','Run leadership communication cadence'],array['ISO 41001'],array['fm_type_1','fm_type_9'],true),
('FM-048','strategic','Stakeholder Resistance Escalation','Key stakeholders resist FM policy or operating changes.','medium','medium',array['Conduct stakeholder influence mapping','Co-design critical decisions','Use phased rollout with feedback loops'],array['ISO 41001'],array['fm_type_1','fm_type_3'],true),
('FM-049','strategic','Technology Adoption Lag','FM digital tools are underused, reducing expected value realisation.','medium','medium',array['Deliver role-based training','Set adoption KPIs','Retire duplicate legacy workflows'],array['ISO 41001','ISO 55001'],array['fm_type_1','fm_type_2','fm_type_9'],true),
('FM-050','strategic','Portfolio Rationalisation Delay','Portfolio optimisation decisions are delayed, locking in avoidable cost and risk.','medium','high',array['Run quarterly portfolio review','Prioritise exit/repurpose cases','Align board-level decision calendar'],array['ISO 41001','ISO 55001'],array['fm_type_1','fm_type_2','fm_type_9'],true)
on conflict (risk_code) do update
set
  category = excluded.category,
  title = excluded.title,
  description = excluded.description,
  typical_probability = excluded.typical_probability,
  typical_impact = excluded.typical_impact,
  recommended_mitigations = excluded.recommended_mitigations,
  iso_references = excluded.iso_references,
  engagement_types = excluded.engagement_types,
  is_active = excluded.is_active,
  updated_at = now();