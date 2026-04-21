-- ============================================================
-- M076: Schema drift fixes (intelligence + email)
-- Date: 2026-04-21
-- Adds missing project intelligence tables, email_drafts table,
-- and missing email_items columns used by triage/inbox routes.
-- ============================================================

-- -----------------------------------------------------------------------------
-- 1) project_source_documents
-- -----------------------------------------------------------------------------
create table if not exists public.project_source_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  filename text not null,
  file_type text,
  source_content text,
  file_size_bytes bigint,
  pages_count integer,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_source_documents_user on public.project_source_documents(user_id);
create index if not exists idx_project_source_documents_project on public.project_source_documents(project_id);
create index if not exists idx_project_source_documents_uploaded_at on public.project_source_documents(uploaded_at desc);

alter table public.project_source_documents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_source_documents' and policyname = 'project_source_documents_user_access'
  ) then
    create policy "project_source_documents_user_access" on public.project_source_documents
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2) document_extracts
-- -----------------------------------------------------------------------------
create table if not exists public.document_extracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  document_id uuid not null references public.project_source_documents(id) on delete cascade,
  extraction_raw jsonb not null default '{}'::jsonb,
  extraction_summary text,
  confidence_score numeric(4,3),
  validation_status text not null default 'pending' check (validation_status in ('pending','validated','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_document_extracts_document_id on public.document_extracts(document_id);
create index if not exists idx_document_extracts_user_id on public.document_extracts(user_id);
create index if not exists idx_document_extracts_validation on public.document_extracts(validation_status);

alter table public.document_extracts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'document_extracts' and policyname = 'document_extracts_user_access'
  ) then
    create policy "document_extracts_user_access" on public.document_extracts
      for all
      using (user_id is null or auth.uid() = user_id)
      with check (user_id is null or auth.uid() = user_id);
  end if;
end $$;

-- Backfill user_id from parent document when available
update public.document_extracts de
set user_id = psd.user_id
from public.project_source_documents psd
where de.user_id is null and de.document_id = psd.id;

-- -----------------------------------------------------------------------------
-- 3) project_risks
-- -----------------------------------------------------------------------------
create table if not exists public.project_risks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  document_id uuid references public.project_source_documents(id) on delete set null,
  risk_description text not null,
  probability text check (probability in ('low','medium','high')),
  impact text check (impact in ('low','medium','high')),
  priority_score integer,
  mitigation_plan text,
  status text not null default 'open' check (status in ('open','monitoring','mitigated','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_risks_user on public.project_risks(user_id);
create index if not exists idx_project_risks_project on public.project_risks(project_id);
create index if not exists idx_project_risks_document on public.project_risks(document_id);
create index if not exists idx_project_risks_status on public.project_risks(status);

alter table public.project_risks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_risks' and policyname = 'project_risks_user_access'
  ) then
    create policy "project_risks_user_access" on public.project_risks
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 4) project_compliance
-- -----------------------------------------------------------------------------
create table if not exists public.project_compliance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  document_id uuid references public.project_source_documents(id) on delete set null,
  compliance_framework text,
  requirement text not null,
  status text not null default 'pending' check (status in ('pending','in_progress','compliant','non_compliant','waived')),
  due_date date,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_compliance_user on public.project_compliance(user_id);
create index if not exists idx_project_compliance_project on public.project_compliance(project_id);
create index if not exists idx_project_compliance_document on public.project_compliance(document_id);
create index if not exists idx_project_compliance_status on public.project_compliance(status);

alter table public.project_compliance enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_compliance' and policyname = 'project_compliance_user_access'
  ) then
    create policy "project_compliance_user_access" on public.project_compliance
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 5) project_intelligence
-- -----------------------------------------------------------------------------
create table if not exists public.project_intelligence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  document_id uuid references public.project_source_documents(id) on delete set null,
  project_title text,
  description text,
  budget_total numeric(14,2),
  budget_currency text,
  scope jsonb not null default '[]'::jsonb,
  deliverables jsonb not null default '[]'::jsonb,
  success_criteria jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  compliance_frameworks jsonb not null default '[]'::jsonb,
  extraction_confidence numeric(4,3),
  source_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_intelligence_user on public.project_intelligence(user_id);
create index if not exists idx_project_intelligence_project on public.project_intelligence(project_id);
create index if not exists idx_project_intelligence_document on public.project_intelligence(document_id);
create index if not exists idx_project_intelligence_created_at on public.project_intelligence(created_at desc);

alter table public.project_intelligence enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_intelligence' and policyname = 'project_intelligence_user_access'
  ) then
    create policy "project_intelligence_user_access" on public.project_intelligence
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 6) email_drafts
-- -----------------------------------------------------------------------------
create table if not exists public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_item_id uuid references public.email_items(id) on delete cascade,
  from_address text,
  to_address text,
  inbox_address text,
  subject text,
  body text,
  triage_class text,
  status text not null default 'draft' check (status in ('draft','sent','discarded')),
  ai_generated boolean not null default false,
  gmail_draft_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(email_item_id)
);

create index if not exists idx_email_drafts_user on public.email_drafts(user_id);
create index if not exists idx_email_drafts_status on public.email_drafts(status);
create index if not exists idx_email_drafts_gmail_draft on public.email_drafts(gmail_draft_id);

alter table public.email_drafts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'email_drafts' and policyname = 'email_drafts_user_access'
  ) then
    create policy "email_drafts_user_access" on public.email_drafts
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 7) email_items missing columns used by triage/inbox flows
-- -----------------------------------------------------------------------------
alter table if exists public.email_items
  add column if not exists inbox_address text,
  add column if not exists triage_at timestamptz,
  add column if not exists gmail_draft_id text;

create index if not exists idx_email_items_inbox_address on public.email_items(inbox_address);
create index if not exists idx_email_items_triage_at on public.email_items(triage_at desc);
create index if not exists idx_email_items_gmail_draft_id on public.email_items(gmail_draft_id);
