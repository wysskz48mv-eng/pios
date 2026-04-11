-- ============================================================
-- PIOS Contract Intelligence Agent System
-- Templates, generated contracts, clause library, agent logs
-- ============================================================

create table if not exists public.contract_templates (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  contract_type           text not null,
  name                    text not null,
  version                 text default '1.0',
  description             text,
  master_content          text not null,
  sections                jsonb,
  placeholders            jsonb,
  policy_rules            jsonb,
  variant_transformations jsonb,
  is_active               boolean default true,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

create index if not exists idx_contract_templates_type on public.contract_templates(contract_type);
create index if not exists idx_contract_templates_user on public.contract_templates(user_id);

alter table public.contract_templates enable row level security;
create policy "contract_templates_own" on public.contract_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.generated_contracts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  template_id           uuid references public.contract_templates(id),
  contract_type         text not null,
  title                 text not null,
  customer_name         text,
  product_name          text,
  context               jsonb not null default '{}'::jsonb,
  generated_content     text,
  variants              jsonb,
  review_status         text default 'draft'
    check (review_status in ('draft','pending_review','approved','rejected')),
  review_notes          text,
  compliance_checks     jsonb,
  file_storage_id       text,
  filed_at              timestamptz,
  generated_by          text,
  generated_at          timestamptz default now()
);

create index if not exists idx_gen_contracts_user on public.generated_contracts(user_id);
create index if not exists idx_gen_contracts_type on public.generated_contracts(contract_type);
create index if not exists idx_gen_contracts_status on public.generated_contracts(review_status);

alter table public.generated_contracts enable row level security;
create policy "gen_contracts_own" on public.generated_contracts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.clause_library (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  contract_type     text not null,
  clause_name       text not null,
  content           text not null,
  prevalence        numeric(5,2),
  variations        jsonb,
  tags              jsonb,
  source_contracts  uuid[] default '{}',
  created_at        timestamptz default now()
);

create index if not exists idx_clause_lib_type on public.clause_library(contract_type);
create index if not exists idx_clause_lib_user on public.clause_library(user_id);

alter table public.clause_library enable row level security;
create policy "clause_lib_own" on public.clause_library
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
