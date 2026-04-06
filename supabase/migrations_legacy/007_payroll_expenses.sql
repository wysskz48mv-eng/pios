-- ============================================================
-- PIOS Migration 007 — Payroll & Expense Workflow
-- Staff management, payroll runs, expense claims, bank transfer queue
-- ============================================================

-- ── 1. Staff / team members ──────────────────────────────────────────────────
create table if not exists public.staff_members (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  full_name       text not null,
  email           text not null,
  role            text,
  company_entity  text,                     -- Which Sustain entity employs them
  employment_type text default 'employee' check (employment_type in (
    'employee','contractor','consultant','director'
  )),
  salary_currency text default 'GBP',
  monthly_salary  numeric(14,2),
  bank_account    text,                     -- Masked: last 4 digits only
  bank_sort_code  text,                     -- Masked
  payment_method  text default 'bank_transfer' check (payment_method in (
    'bank_transfer','cheque','cash','paypal','wise'
  )),
  is_active       boolean default true,
  start_date      date,
  end_date        date,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 2. Payroll runs ───────────────────────────────────────────────────────────
create table if not exists public.payroll_runs (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  pay_period      text not null,            -- e.g. "March 2026"
  pay_date        date,
  status          text default 'draft' check (status in (
    'draft','pending_approval','approved','processing','paid','failed'
  )),
  source          text default 'manual' check (source in (
    'manual','email_detected','accountant_submitted'
  )),
  source_email_id uuid references public.email_items(id) on delete set null,
  total_gross     numeric(14,2),
  total_net       numeric(14,2),
  total_tax       numeric(14,2),
  currency        text default 'GBP',
  company_entity  text,
  notes           text,
  approved_at     timestamptz,
  paid_at         timestamptz,
  -- Chase workflow
  expected_by     date,                     -- When payroll should arrive from accountant
  chase_count     integer default 0,
  last_chased_at  timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 3. Payroll line items (per staff member per run) ─────────────────────────
create table if not exists public.payroll_lines (
  id              uuid primary key default uuid_generate_v4(),
  payroll_run_id  uuid references public.payroll_runs(id) on delete cascade not null,
  staff_member_id uuid references public.staff_members(id) on delete set null,
  user_id         uuid references auth.users(id) on delete cascade not null,
  staff_name      text not null,
  staff_email     text not null,
  gross_pay       numeric(14,2) not null,
  tax_deduction   numeric(14,2) default 0,
  ni_deduction    numeric(14,2) default 0,   -- National Insurance (UK)
  pension         numeric(14,2) default 0,
  other_deductions numeric(14,2) default 0,
  net_pay         numeric(14,2) not null,
  -- Remittance
  remittance_sent boolean default false,
  remittance_sent_at timestamptz,
  bank_transfer_queued boolean default false,
  transfer_reference text,
  created_at      timestamptz default now()
);

-- ── 4. Expense claims ────────────────────────────────────────────────────────
-- Enhanced expense claims with approval workflow
create table if not exists public.expense_claims (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,

  -- Claimant (may be Douglas himself or a staff member)
  claimant_name   text not null,
  claimant_email  text,
  staff_member_id uuid references public.staff_members(id) on delete set null,

  -- Claim details
  claim_period    text,                     -- e.g. "March 2026"
  description     text not null,
  amount          numeric(14,2) not null,
  currency        text default 'GBP',
  category        text check (category in (
    'travel','accommodation','meals','software','hardware','research',
    'professional_fees','training','marketing','utilities','other'
  )),
  domain          text default 'business',
  expense_date    date,

  -- Tax / compliance
  vat_reclaimable boolean default false,
  vat_amount      numeric(14,2),
  tax_year        text,                     -- e.g. "2025-26"
  receipt_url     text,
  receipt_file_id uuid references public.file_items(id) on delete set null,
  invoice_id      uuid references public.invoices(id) on delete set null,

  -- Project / entity routing
  project_id      uuid references public.projects(id) on delete set null,
  company_entity  text,
  billable_to_client boolean default false,
  client_name     text,

  -- Approval workflow
  status          text default 'submitted' check (status in (
    'draft','submitted','approved','rejected','paid','queued_for_payment'
  )),
  submitted_at    timestamptz,
  approved_at     timestamptz,
  approved_by     text,
  rejection_reason text,
  payment_date    date,
  transfer_reference text,
  notes           text,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 5. Bank transfer queue ───────────────────────────────────────────────────
create table if not exists public.transfer_queue (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  transfer_type   text not null check (transfer_type in (
    'payroll','expense_claim','invoice_payment','supplier_payment','other'
  )),
  -- Reference to source
  payroll_line_id uuid references public.payroll_lines(id) on delete set null,
  expense_claim_id uuid references public.expense_claims(id) on delete set null,
  invoice_id      uuid references public.invoices(id) on delete set null,
  -- Payment details
  recipient_name  text not null,
  recipient_email text,
  amount          numeric(14,2) not null,
  currency        text default 'GBP',
  reference       text,                     -- Payment reference
  bank_account    text,                     -- Masked destination
  -- Status
  status          text default 'queued' check (status in (
    'queued','approved','processing','completed','failed','cancelled'
  )),
  approved_at     timestamptz,
  completed_at    timestamptz,
  failure_reason  text,
  -- HITL gate
  requires_approval boolean default true,
  approved_by     text,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 6. Payroll chase log ─────────────────────────────────────────────────────
create table if not exists public.payroll_chase_log (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  payroll_run_id  uuid references public.payroll_runs(id) on delete cascade,
  chase_type      text check (chase_type in ('reminder','escalation','formal_chase','resolved')),
  sent_to         text,
  subject         text,
  message         text,
  sent_at         timestamptz default now()
);

-- ── 7. RLS ───────────────────────────────────────────────────────────────────
alter table public.staff_members    enable row level security;
alter table public.payroll_runs     enable row level security;
alter table public.payroll_lines    enable row level security;
alter table public.expense_claims   enable row level security;
alter table public.transfer_queue   enable row level security;
alter table public.payroll_chase_log enable row level security;

create policy "own_staff"    on public.staff_members    for all using (auth.uid() = user_id);
create policy "own_payroll"  on public.payroll_runs     for all using (auth.uid() = user_id);
create policy "own_p_lines"  on public.payroll_lines    for all using (auth.uid() = user_id);
create policy "own_claims"   on public.expense_claims   for all using (auth.uid() = user_id);
create policy "own_transfers" on public.transfer_queue  for all using (auth.uid() = user_id);
create policy "own_chase"    on public.payroll_chase_log for all using (auth.uid() = user_id);

-- ── 8. Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_staff_user          on public.staff_members(user_id, is_active);
create index if not exists idx_payroll_user        on public.payroll_runs(user_id, status);
create index if not exists idx_payroll_lines_run   on public.payroll_lines(payroll_run_id);
create index if not exists idx_claims_user         on public.expense_claims(user_id, status);
create index if not exists idx_transfers_user      on public.transfer_queue(user_id, status);

-- ── 9. Verify ────────────────────────────────────────────────────────────────
select
  (select count(*) from public.staff_members)   as staff,
  (select count(*) from public.payroll_runs)     as payroll_runs,
  (select count(*) from public.expense_claims)   as expense_claims,
  (select count(*) from public.transfer_queue)   as transfers;
