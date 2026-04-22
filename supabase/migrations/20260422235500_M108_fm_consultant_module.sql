-- M108: FM Consultant module (alpha complete)
-- Replaces prior M085 naming and aligns to timestamp-ordered execution.

create or replace function public.pios_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1) FM engagement types
create table if not exists public.fm_engagement_types (
  id uuid primary key default gen_random_uuid(),
  type_code text not null unique,
  type_number integer not null check (type_number between 1 and 9),
  name text not null,
  description text not null,
  wave integer not null check (wave between 1 and 3),
  recommended_frameworks jsonb,
  iso_standards text[],
  regulatory_refs text[],
  typical_duration_weeks integer,
  complexity_level text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_fm_engagement_types_wave on public.fm_engagement_types(wave, is_active);

-- 2) FM risk library
create table if not exists public.fm_risk_library (
  id uuid primary key default gen_random_uuid(),
  risk_code text not null unique,
  category text not null,
  title text not null,
  description text not null,
  typical_probability text,
  typical_impact text,
  recommended_mitigations text[],
  iso_references text[],
  engagement_types text[],
  discipline text,
  asset_class text,
  rics_category text,
  ppm_impact text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.fm_risk_library
  add column if not exists discipline text,
  add column if not exists asset_class text,
  add column if not exists rics_category text,
  add column if not exists ppm_impact text,
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_fm_risk_library_category on public.fm_risk_library(category);
create index if not exists idx_fm_risk_library_engagement_types on public.fm_risk_library using gin(engagement_types);
create index if not exists idx_fm_risk_library_search on public.fm_risk_library using gin(to_tsvector('english', coalesce(risk_code,'') || ' ' || coalesce(title,'') || ' ' || coalesce(description,'')));

-- 2.5) Ensure consulting_engagements has tenant_id for downstream FK + RLS consistency
alter table public.consulting_engagements
  add column if not exists tenant_id uuid references public.tenants(id);

update public.consulting_engagements ce
set tenant_id = up.tenant_id
from public.user_profiles up
where ce.tenant_id is null
  and up.tenant_id is not null
  and up.user_id = ce.user_id;

-- Fallback for environments where user_profiles.id is canonical and user_id may be sparse
update public.consulting_engagements ce
set tenant_id = up.tenant_id
from public.user_profiles up
where ce.tenant_id is null
  and up.tenant_id is not null
  and up.id = ce.user_id;

do $$
begin
  if exists (select 1 from public.consulting_engagements where tenant_id is null) then
    raise exception 'M108 backfill failed: consulting_engagements.tenant_id remains NULL for % rows',
      (select count(*) from public.consulting_engagements where tenant_id is null);
  end if;
end $$;

alter table public.consulting_engagements
  alter column tenant_id set not null;

create index if not exists idx_consulting_engagements_tenant_id on public.consulting_engagements(tenant_id);

-- 3) Engagement risks
create table if not exists public.engagement_risks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  engagement_id uuid not null references public.consulting_engagements(id) on delete cascade,
  risk_library_id uuid references public.fm_risk_library(id),
  custom_title text,
  custom_description text,
  probability text not null check (probability in ('low', 'medium', 'high')),
  impact text not null check (impact in ('low', 'medium', 'high')),
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
  mitigation_status text default 'open' check (mitigation_status in ('open', 'mitigating', 'mitigated', 'accepted')),
  owner_user_id uuid references auth.users(id),
  identified_date date default current_date,
  target_closure_date date,
  actual_closure_date date,
  notes text,
  linked_email_ids uuid[] default '{}'::uuid[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.engagement_risks
  add column if not exists tenant_id uuid references public.tenants(id),
  add column if not exists linked_email_ids uuid[] default '{}'::uuid[],
  add column if not exists updated_at timestamptz default now();

update public.engagement_risks er
set tenant_id = ce.tenant_id
from public.consulting_engagements ce
where er.engagement_id = ce.id
  and er.tenant_id is null;

create index if not exists idx_engagement_risks_engagement on public.engagement_risks(engagement_id);
create index if not exists idx_engagement_risks_score on public.engagement_risks(risk_score desc);

-- 4) FM options
create table if not exists public.fm_options (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  engagement_id uuid not null references public.consulting_engagements(id) on delete cascade,
  option_number integer not null check (option_number between 1 and 4),
  title text not null,
  description text not null,
  pros text[],
  cons text[],
  estimated_cost_min numeric,
  estimated_cost_max numeric,
  cost_currency text default 'GBP',
  implementation_time_weeks integer,
  risk_level text check (risk_level in ('low', 'medium', 'high')),
  is_recommended boolean default false,
  recommendation_reasoning text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(engagement_id, option_number)
);

alter table public.fm_options
  add column if not exists tenant_id uuid references public.tenants(id),
  add column if not exists updated_at timestamptz default now();

update public.fm_options fo
set tenant_id = ce.tenant_id
from public.consulting_engagements ce
where fo.engagement_id = ce.id
  and fo.tenant_id is null;

create index if not exists idx_fm_options_engagement on public.fm_options(engagement_id);

-- 5) FM precedents
create table if not exists public.fm_precedents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  title text not null,
  engagement_type text not null,
  industry_sector text,
  building_type text,
  project_scale text check (project_scale in ('small', 'medium', 'large', 'portfolio')),
  anonymized_excerpt text,
  tags text[],
  frameworks_used text[],
  reusable_artifacts jsonb,
  original_engagement_id uuid,
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.fm_precedents
  add column if not exists tenant_id uuid references public.tenants(id),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'fm_precedents' and column_name = 'user_id'
  ) then
    execute $q$
      update public.fm_precedents fp
      set tenant_id = up.tenant_id
      from public.user_profiles up
      where fp.tenant_id is null and fp.user_id = up.id
    $q$;
  end if;

  update public.fm_precedents fp
  set tenant_id = ce.tenant_id
  from public.consulting_engagements ce
  where fp.tenant_id is null
    and fp.original_engagement_id = ce.id;
end $$;

create index if not exists idx_fm_precedents_type on public.fm_precedents(engagement_type);
create index if not exists idx_fm_precedents_search on public.fm_precedents using gin(to_tsvector('english', title || ' ' || coalesce(anonymized_excerpt, '')));

-- 6) Email integration fields and correlation function
alter table public.consulting_engagements
  add column if not exists linked_email_ids uuid[],
  add column if not exists auto_correlation_enabled boolean default true;

create or replace function public.correlate_emails_to_engagement(p_engagement_id uuid)
returns integer as $$
declare
  v_engagement record;
  v_correlated_count integer := 0;
  v_email_count integer := 0;
begin
  select * into v_engagement from public.consulting_engagements where id = p_engagement_id;

  if v_engagement.client_name is null then
    return 0;
  end if;

  update public.consulting_engagements
  set linked_email_ids = array(
    select distinct e.id
    from public.email_items e
    where e.tenant_id = v_engagement.tenant_id
      and e.user_id = v_engagement.user_id
      and (
        coalesce(e.sender_name, '') ilike '%' || v_engagement.client_name || '%'
        or coalesce(e.sender_name, '') ilike '%' || v_engagement.client_name || '%'
        or coalesce(e.subject, '') ilike '%' || v_engagement.client_name || '%'
      )
      and e.received_at >= v_engagement.created_at - interval '30 days'
    order by e.received_at desc
    limit 50
  )
  where id = p_engagement_id;

  get diagnostics v_correlated_count = row_count;

  select coalesce(cardinality(linked_email_ids), 0)
    into v_email_count
  from public.consulting_engagements
  where id = p_engagement_id;

  return case when v_correlated_count > 0 then v_email_count else 0 end;
end;
$$ language plpgsql;

-- 7) Updated-at triggers
drop trigger if exists trg_fm_engagement_types_updated_at on public.fm_engagement_types;
create trigger trg_fm_engagement_types_updated_at before update on public.fm_engagement_types for each row execute function public.pios_set_updated_at();

drop trigger if exists trg_fm_risk_library_updated_at on public.fm_risk_library;
create trigger trg_fm_risk_library_updated_at before update on public.fm_risk_library for each row execute function public.pios_set_updated_at();

drop trigger if exists trg_engagement_risks_updated_at on public.engagement_risks;
create trigger trg_engagement_risks_updated_at before update on public.engagement_risks for each row execute function public.pios_set_updated_at();

drop trigger if exists trg_fm_options_updated_at on public.fm_options;
create trigger trg_fm_options_updated_at before update on public.fm_options for each row execute function public.pios_set_updated_at();

drop trigger if exists trg_fm_precedents_updated_at on public.fm_precedents;
create trigger trg_fm_precedents_updated_at before update on public.fm_precedents for each row execute function public.pios_set_updated_at();

-- 8) RLS
alter table public.consulting_engagements enable row level security;
alter table public.fm_engagement_types enable row level security;
alter table public.fm_risk_library enable row level security;
alter table public.engagement_risks enable row level security;
alter table public.fm_options enable row level security;
alter table public.fm_precedents enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='consulting_engagements' and policyname='consulting_engagements_tenant_owner') then
    create policy consulting_engagements_tenant_owner on public.consulting_engagements
      for all
      using (
        user_id = auth.uid()
        and tenant_id = (
          select up.tenant_id
          from public.user_profiles up
          where up.id = auth.uid() or up.user_id = auth.uid()
          limit 1
        )
      )
      with check (
        user_id = auth.uid()
        and tenant_id = (
          select up.tenant_id
          from public.user_profiles up
          where up.id = auth.uid() or up.user_id = auth.uid()
          limit 1
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fm_engagement_types' and policyname='fm_engagement_types_read') then
    create policy fm_engagement_types_read on public.fm_engagement_types for select using (auth.role() = 'authenticated' and is_active = true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fm_risk_library' and policyname='fm_risk_library_read') then
    create policy fm_risk_library_read on public.fm_risk_library for select using (auth.role() = 'authenticated' and is_active = true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='engagement_risks' and policyname='engagement_risks_tenant_owner') then
    create policy engagement_risks_tenant_owner on public.engagement_risks
      for all
      using (
        exists (
          select 1 from public.consulting_engagements ce
          where ce.id = engagement_risks.engagement_id
            and ce.user_id = auth.uid()
            and ce.tenant_id = engagement_risks.tenant_id
        )
      )
      with check (
        exists (
          select 1 from public.consulting_engagements ce
          where ce.id = engagement_risks.engagement_id
            and ce.user_id = auth.uid()
            and ce.tenant_id = engagement_risks.tenant_id
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fm_options' and policyname='fm_options_tenant_owner') then
    create policy fm_options_tenant_owner on public.fm_options
      for all
      using (
        exists (
          select 1 from public.consulting_engagements ce
          where ce.id = fm_options.engagement_id
            and ce.user_id = auth.uid()
            and ce.tenant_id = fm_options.tenant_id
        )
      )
      with check (
        exists (
          select 1 from public.consulting_engagements ce
          where ce.id = fm_options.engagement_id
            and ce.user_id = auth.uid()
            and ce.tenant_id = fm_options.tenant_id
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fm_precedents' and policyname='fm_precedents_tenant_read') then
    create policy fm_precedents_tenant_read on public.fm_precedents
      for select
      using (
        is_public = true
        or tenant_id = (select up.tenant_id from public.user_profiles up where up.id = auth.uid())
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fm_precedents' and policyname='fm_precedents_tenant_write') then
    create policy fm_precedents_tenant_write on public.fm_precedents
      for all
      using (tenant_id = (select up.tenant_id from public.user_profiles up where up.id = auth.uid()))
      with check (tenant_id = (select up.tenant_id from public.user_profiles up where up.id = auth.uid()));
  end if;
end $$;

-- 9) Seed Wave 1 FM engagement types
insert into public.fm_engagement_types
(type_code, type_number, name, description, wave, recommended_frameworks, iso_standards, regulatory_refs, typical_duration_weeks, complexity_level, is_active)
values
  ('fm_type_1', 1, 'FM Strategy', 'Strategic facilities management planning and roadmap development', 1,
   '{"step_1": ["smart_goals", "stakeholder_analysis"], "step_2": ["issue_tree", "hypothesis_tree"], "step_4": ["raci_matrix", "gantt_timeline"]}'::jsonb,
   array['ISO 41001', 'ISO 55001'], array['RICS FM'], 8, 'high', true),
  ('fm_type_2', 2, 'Cost Benchmarking', 'FM cost analysis and benchmarking', 1,
   '{"step_3": ["pareto_80_20", "impact_effort_matrix"], "step_5": ["hypothesis_testing"]}'::jsonb,
   array['ISO 41001'], array['RICS FM'], 4, 'medium', true),
  ('fm_type_3', 3, 'Audit & Compliance', 'FM audit and regulatory compliance', 1,
   '{"step_2": ["mece_validator"], "step_4": ["risk_register"], "step_5": ["hypothesis_testing"]}'::jsonb,
   array['ISO 41001', 'ISO 19011', 'ISO 55001'], array['Building Safety Act 2022'], 6, 'high', true),
  ('fm_type_9', 9, 'RIBA Integration', 'Building lifecycle FM (RIBA Stages 0-7)', 1,
   '{"step_1": ["smart_goals", "scope_constraints"], "step_2": ["issue_tree"], "step_4": ["raci_matrix", "risk_register"]}'::jsonb,
   array['ISO 41001', 'ISO 55001'], array['RIBA Plan of Work'], 12, 'high', true)
on conflict (type_code) do update
set type_number = excluded.type_number,
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

-- 10) Seed FM risk library FM-001..FM-050
insert into public.fm_risk_library (risk_code, category, title, description, typical_probability, typical_impact, recommended_mitigations, iso_references, engagement_types, discipline, asset_class, rics_category, ppm_impact, is_active)
values
  -- Operational risks
  ('FM-001', 'operational', 'Service Disruption', 'Critical FM service interruption affecting building operations', 'medium', 'high',
   array['Implement redundancy systems', 'Establish backup contractor relationships', '24/7 monitoring protocols'],
   array['ISO 41001'], array['fm_type_1', 'fm_type_3'], 'fm', 'building_systems', 'operations', 'high', true),
  ('FM-002', 'operational', 'Asset Failure', 'Unexpected failure of critical building systems or equipment', 'medium', 'high',
   array['Preventive maintenance program', 'Condition monitoring', 'Lifecycle replacement planning'],
   array['ISO 55001'], array['fm_type_1', 'fm_type_3', 'fm_type_9'], 'fm', 'plant_equipment', 'operations', 'high', true),
  ('FM-003', 'operational', 'Contractor Performance Failure', 'Service provider fails to meet SLA requirements', 'high', 'medium',
   array['Performance KPIs and monitoring', 'Penalty clauses in contracts', 'Alternative supplier identification'],
   array['ISO 41001'], array['fm_type_1', 'fm_type_3'], 'fm', 'service_contracts', 'supplier', 'medium', true),
  ('FM-004', 'operational', 'Maintenance Backlog', 'Accumulated deferred maintenance creating risk', 'high', 'high',
   array['Condition assessment program', 'Prioritized remediation plan', 'Budget allocation for catch-up'],
   array['ISO 55001'], array['fm_type_1', 'fm_type_2', 'fm_type_3'], 'fm', 'maintenance', 'operations', 'high', true),
  ('FM-005', 'operational', 'Space Utilization Inefficiency', 'Underutilized or poorly configured space', 'medium', 'medium',
   array['Space utilization study', 'Hot-desking implementation', 'Reconfiguration planning'],
   array['ISO 41001'], array['fm_type_1', 'fm_type_2'], 'fm', 'workspace', 'occupancy', 'medium', true),
  ('FM-006', 'operational', 'Cleaning Service Inadequacy', 'Substandard cleaning affecting occupant satisfaction', 'high', 'low',
   array['Quality audits', 'Occupant feedback mechanisms', 'Contract specification review'],
   array['ISO 41001'], array['fm_type_1', 'fm_type_3'], 'fm', 'soft_services', 'cleaning', 'medium', true),
  ('FM-007', 'operational', 'Security System Compromise', 'Access control or surveillance system failure', 'low', 'high',
   array['Regular system testing', 'Cybersecurity protocols', 'Backup access procedures'],
   array['ISO 41001'], array['fm_type_1', 'fm_type_3', 'fm_type_9'], 'fm', 'security', 'security', 'high', true),
  ('FM-008', 'operational', 'Energy System Failure', 'HVAC or power system outage', 'medium', 'high',
   array['Backup power systems', 'Preventive maintenance', 'Emergency response protocols'],
   array['ISO 50001', 'ISO 55001'], array['fm_type_1', 'fm_type_3'], 'fm', 'energy_systems', 'utilities', 'high', true),
  ('FM-009', 'operational', 'Data Loss in CAFM System', 'Loss of asset or maintenance data', 'low', 'medium',
   array['Regular backups', 'Cloud-based redundancy', 'Data recovery procedures'],
   array['ISO 41001'], array['fm_type_1'], 'fm', 'digital', 'information', 'medium', true),
  ('FM-010', 'operational', 'Vendor Lock-in', 'Over-dependence on single service provider', 'medium', 'medium',
   array['Diversified supplier strategy', 'Knowledge transfer requirements', 'Transition planning'],
   array['ISO 41001'], array['fm_type_1'], 'fm', 'service_contracts', 'supplier', 'medium', true),
  ('FM-011', 'operational', 'Response Time Breach', 'Failure to meet emergency response SLAs', 'medium', 'high',
   array['24/7 helpdesk coverage', 'Mobile workforce management', 'Escalation protocols'],
   array['ISO 41001'], array['fm_type_1', 'fm_type_3'], 'fm', 'service_desk', 'operations', 'high', true),
  ('FM-012', 'operational', 'Equipment Obsolescence', 'Critical equipment no longer supported', 'low', 'medium',
   array['Lifecycle planning', 'Obsolescence monitoring', 'Replacement budgeting'],
   array['ISO 55001'], array['fm_type_1', 'fm_type_9'], 'fm', 'plant_equipment', 'lifecycle', 'medium', true),
  ('FM-013', 'operational', 'Consumables Shortage', 'Stock-out of critical supplies', 'medium', 'low',
   array['Inventory management system', 'Just-in-time procurement', 'Buffer stock policies'],
   array['ISO 41001'], array['fm_type_1'], 'fm', 'supplies', 'procurement', 'low', true),
  ('FM-014', 'operational', 'Workplace Density Overcrowding', 'Exceeding safe occupancy levels', 'medium', 'medium',
   array['Occupancy sensors', 'Booking systems', 'Flexible working policies'],
   array['ISO 41001'], array['fm_type_1', 'fm_type_2'], 'fm', 'workspace', 'occupancy', 'medium', true),
  ('FM-015', 'operational', 'Pest Infestation', 'Rodent or insect infestation affecting operations', 'low', 'low',
   array['Regular pest control services', 'Hygiene protocols', 'Building envelope maintenance'],
   array['ISO 41001'], array['fm_type_1', 'fm_type_3'], 'fm', 'building_envelope', 'hygiene', 'low', true),

  -- Financial risks
  ('FM-016', 'financial', 'Budget Overrun', 'FM costs exceed allocated budget', 'high', 'high',
   array['Monthly budget tracking', 'Change control process', 'Contingency reserves'],
   array['ISO 41001'], array['fm_type_1', 'fm_type_2'], 'fm', 'finance', 'cost_control', 'high', true),
  ('FM-017', 'financial', 'Cost Escalation', 'Unexpected increase in service costs', 'high', 'medium',
   array['Multi-year fixed-price contracts', 'Market benchmarking', 'Index-linked pricing caps'],
   array['ISO 41001'], array['fm_type_2'], 'fm', 'finance', 'procurement', 'medium', true),
  ('FM-018', 'financial', 'Hidden Costs Discovery', 'Unforeseen FM cost obligations', 'medium', 'medium',
   array['Comprehensive due diligence', 'Service charge audits', 'Contract review'],
   array['ISO 41001'], array['fm_type_2', 'fm_type_3'], 'fm', 'finance', 'audit', 'medium', true),
  ('FM-019', 'financial', 'Procurement Inefficiency', 'Non-competitive or wasteful purchasing', 'high', 'medium',
   array['Tender processes', 'Framework agreements', 'Category management'],
   array['ISO 41001'], array['fm_type_1', 'fm_type_2'], 'fm', 'procurement', 'cost_control', 'medium', true),
  ('FM-020', 'financial', 'Capital vs Operational Mix', 'Incorrect expense classification affecting accounts', 'medium', 'low',
   array['Clear capitalization policy', 'Finance team coordination', 'Audit trails'],
   array['ISO 41001'], array['fm_type_2'], 'fm', 'finance', 'accounting', 'low', true),
  ('FM-021', 'financial', 'Service Charge Disputes', 'Tenant challenges on recoverable costs', 'medium', 'medium',
   array['Transparent reporting', 'Industry-standard schedules', 'Regular reconciliation'],
   array['ISO 41001'], array['fm_type_2'], 'fm', 'service_charges', 'landlord_tenant', 'medium', true),
  ('FM-022', 'financial', 'Currency Fluctuation', 'FX risk on international FM contracts', 'low', 'medium',
   array['Hedging strategies', 'Local currency contracts', 'Periodic rate reviews'],
   array['ISO 41001'], array['fm_type_2'], 'fm', 'finance', 'treasury', 'low', true),
  ('FM-023', 'financial', 'Warranty Expiry Untracked', 'Paying for repairs covered under warranty', 'high', 'low',
   array['Warranty register', 'Automated alerts', 'Handover documentation'],
   array['ISO 55001'], array['fm_type_1', 'fm_type_9'], 'fm', 'asset_lifecycle', 'warranty', 'medium', true),
  ('FM-024', 'financial', 'Unbudgeted Lifecycle Replacement', 'Major asset replacement not planned', 'medium', 'high',
   array['10-year lifecycle plan', 'Sinking fund', 'Condition-based forecasting'],
   array['ISO 55001'], array['fm_type_1', 'fm_type_2'], 'fm', 'asset_lifecycle', 'capital_planning', 'high', true),
  ('FM-025', 'financial', 'Payment Terms Misalignment', 'Cash flow issues from payment schedules', 'medium', 'low',
   array['Payment milestone alignment', 'Credit control', 'Invoice validation'],
   array['ISO 41001'], array['fm_type_2'], 'fm', 'finance', 'cashflow', 'low', true),

  -- Compliance risks
  ('FM-026', 'compliance', 'Building Safety Act Non-Compliance', 'Failure to meet BSA 2022 requirements', 'low', 'high',
   array['Golden Thread data management', 'Accountable Person designation', 'Safety case preparation'],
   array['ISO 41001'], array['fm_type_3', 'fm_type_9'], 'fm', 'compliance', 'building_safety', 'high', true),
  ('FM-027', 'compliance', 'Fire Safety Certificate Lapse', 'Expired or invalid fire safety certification', 'low', 'high',
   array['Certificate register', 'Renewal reminders', 'Competent person appointments'],
   array['ISO 41001'], array['fm_type_3'], 'fm', 'compliance', 'fire_safety', 'high', true),
  ('FM-028', 'compliance', 'Asbestos Management Breach', 'Inadequate asbestos register or controls', 'low', 'high',
   array['Type 3 asbestos survey', 'Management plan', 'Permit-to-work system'],
   array['ISO 41001'], array['fm_type_3'], 'fm', 'compliance', 'asbestos', 'high', true),
  ('FM-029', 'compliance', 'Legionella Risk Uncontrolled', 'Water system legionella non-compliance', 'low', 'high',
   array['L8 risk assessment', 'Water treatment regime', 'Monthly temperature checks'],
   array['ISO 41001'], array['fm_type_3'], 'fm', 'compliance', 'water_hygiene', 'high', true),
  ('FM-030', 'compliance', 'Electrical Safety Testing Overdue', 'Expired EICR or PAT testing', 'medium', 'medium',
   array['Testing schedule', 'Qualified electricians', 'Defect remediation tracking'],
   array['ISO 41001'], array['fm_type_3'], 'fm', 'compliance', 'electrical', 'medium', true),
  ('FM-031', 'compliance', 'Gas Safety Non-Compliance', 'Landlord Gas Safety Record lapses', 'low', 'high',
   array['Annual inspection program', 'Gas Safe registered engineers', 'Certificate distribution'],
   array['ISO 41001'], array['fm_type_3'], 'fm', 'compliance', 'gas_safety', 'high', true),
  ('FM-032', 'compliance', 'EPC Expiry', 'Energy Performance Certificate out of date', 'medium', 'low',
   array['Certificate tracking', 'DEA appointments', 'Improvement measure planning'],
   array['ISO 50001'], array['fm_type_3'], 'fm', 'compliance', 'energy_performance', 'medium', true),
  ('FM-033', 'compliance', 'Accessibility Failure', 'Non-compliance with Equality Act provisions', 'low', 'medium',
   array['Access audits', 'Reasonable adjustment plans', 'Staff training'],
   array['ISO 41001'], array['fm_type_3', 'fm_type_9'], 'fm', 'compliance', 'accessibility', 'medium', true),
  ('FM-034', 'compliance', 'Waste Duty of Care Breach', 'Improper waste documentation or disposal', 'medium', 'low',
   array['Licensed waste carriers', 'Transfer notes', 'Waste hierarchy compliance'],
   array['ISO 14001'], array['fm_type_3'], 'fm', 'compliance', 'waste', 'low', true),
  ('FM-035', 'compliance', 'Data Protection Violation', 'GDPR breach via FM data handling', 'low', 'medium',
   array['Data processing agreements', 'Access controls', 'Privacy impact assessments'],
   array['ISO 27001'], array['fm_type_3'], 'fm', 'compliance', 'data_protection', 'medium', true),

  -- Health & Safety risks
  ('FM-036', 'health_safety', 'Slip/Trip Hazard', 'Unsafe floor conditions or obstructions', 'high', 'low',
   array['Regular inspections', 'Spillage procedures', 'Signage protocols'],
   array['ISO 45001'], array['fm_type_1', 'fm_type_3'], 'fm', 'hse', 'workplace_safety', 'medium', true),
  ('FM-037', 'health_safety', 'Working at Height Incident', 'Falls from ladders or elevated platforms', 'low', 'high',
   array['Competent person training', 'Equipment inspection', 'Method statements'],
   array['ISO 45001'], array['fm_type_3'], 'fm', 'hse', 'working_at_height', 'high', true),
  ('FM-038', 'health_safety', 'Confined Space Entry Risk', 'Unsafe entry to tanks, voids, or plant rooms', 'low', 'high',
   array['Permit-to-work system', 'Gas detection', 'Emergency rescue procedures'],
   array['ISO 45001'], array['fm_type_3'], 'fm', 'hse', 'confined_space', 'high', true),
  ('FM-039', 'health_safety', 'Electrical Shock', 'Live electrical work or faulty equipment', 'low', 'high',
   array['Isolation procedures', 'RCD protection', 'Competent persons'],
   array['ISO 45001'], array['fm_type_3'], 'fm', 'hse', 'electrical_safety', 'high', true),
  ('FM-040', 'health_safety', 'Manual Handling Injury', 'Musculoskeletal disorders from lifting', 'high', 'low',
   array['Risk assessments', 'Mechanical aids', 'Training'],
   array['ISO 45001'], array['fm_type_1', 'fm_type_3'], 'fm', 'hse', 'manual_handling', 'medium', true),
  ('FM-041', 'health_safety', 'Hazardous Substance Exposure', 'Contact with chemicals or harmful materials', 'medium', 'medium',
   array['COSHH assessments', 'PPE provision', 'Storage controls'],
   array['ISO 45001'], array['fm_type_3'], 'fm', 'hse', 'hazardous_substances', 'medium', true),
  ('FM-042', 'health_safety', 'Emergency Egress Blocked', 'Fire exits obstructed or locked', 'low', 'high',
   array['Daily checks', 'Clear signage', 'Occupant awareness'],
   array['ISO 41001'], array['fm_type_3'], 'fm', 'hse', 'fire_egress', 'high', true),
  ('FM-043', 'health_safety', 'Lone Working Incident', 'Injury to staff working alone', 'low', 'medium',
   array['Buddy systems', 'Check-in procedures', 'Personal alarms'],
   array['ISO 45001'], array['fm_type_1', 'fm_type_3'], 'fm', 'hse', 'lone_working', 'medium', true),
  ('FM-044', 'health_safety', 'Occupant Illness Outbreak', 'Spread of infectious disease in building', 'medium', 'medium',
   array['Ventilation optimization', 'Cleaning protocols', 'Occupancy management'],
   array['ISO 41001'], array['fm_type_1'], 'fm', 'hse', 'public_health', 'medium', true),
  ('FM-045', 'health_safety', 'First Aid Deficiency', 'Inadequate first aid provision or training', 'medium', 'low',
   array['Needs assessment', 'Trained first aiders', 'Equipment maintenance'],
   array['ISO 45001'], array['fm_type_3'], 'fm', 'hse', 'first_aid', 'low', true),

  -- Strategic risks
  ('FM-046', 'strategic', 'FM Strategy Misalignment', 'FM plan does not support business objectives', 'medium', 'high',
   array['Strategic planning workshops', 'Executive sponsorship', 'KPI alignment'],
   array['ISO 41001'], array['fm_type_1'], 'fm', 'strategy', 'governance', 'high', true),
  ('FM-047', 'strategic', 'Change Management Failure', 'Resistance to new FM operating model', 'high', 'medium',
   array['Stakeholder engagement', 'Communication plan', 'Training programs'],
   array['ISO 41001'], array['fm_type_1'], 'fm', 'strategy', 'change_management', 'medium', true),
  ('FM-048', 'strategic', 'Stakeholder Resistance', 'Opposition from key parties to FM initiatives', 'high', 'medium',
   array['Early consultation', 'Benefits communication', 'Pilot demonstrations'],
   array['ISO 41001'], array['fm_type_1'], 'fm', 'strategy', 'stakeholder_management', 'medium', true),
  ('FM-049', 'strategic', 'Technology Adoption Delay', 'Slow uptake of digitalization initiatives', 'medium', 'medium',
   array['User-centered design', 'Phased rollout', 'Champion network'],
   array['ISO 41001'], array['fm_type_1'], 'fm', 'strategy', 'digital_transformation', 'medium', true),
  ('FM-050', 'strategic', 'Reputation Damage', 'FM failures impacting organizational brand', 'low', 'high',
   array['Service level monitoring', 'Crisis communication plan', 'Incident response'],
   array['ISO 41001'], array['fm_type_1', 'fm_type_3'], 'fm', 'strategy', 'reputation', 'high', true)
on conflict (risk_code) do update
set category = excluded.category,
    title = excluded.title,
    description = excluded.description,
    typical_probability = excluded.typical_probability,
    typical_impact = excluded.typical_impact,
    recommended_mitigations = excluded.recommended_mitigations,
    iso_references = excluded.iso_references,
    engagement_types = excluded.engagement_types,
    discipline = excluded.discipline,
    asset_class = excluded.asset_class,
    rics_category = excluded.rics_category,
    ppm_impact = excluded.ppm_impact,
    is_active = excluded.is_active,
    updated_at = now();
