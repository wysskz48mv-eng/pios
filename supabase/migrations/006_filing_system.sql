-- ============================================================
-- PIOS Migration 006 — File Intelligence & Filing System
-- Drive integration, invoice extraction, filing rules
-- ============================================================

-- ── 1. File spaces (virtual folder structure) ────────────────────────────────
-- Mirrors the organised folder structure PIOS maintains
create table if not exists public.file_spaces (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  name          text not null,
  path          text not null,              -- e.g. /Projects/Qiddiya/Contracts
  parent_id     uuid references public.file_spaces(id) on delete cascade,
  space_type    text default 'folder' check (space_type in (
    'folder','project','company','academic','personal','archive','inbox'
  )),
  drive_folder_id text,                     -- Google Drive folder ID (if synced)
  colour        text default '#6c8eff',
  icon          text default '📁',
  sort_order    integer default 0,
  is_auto       boolean default false,      -- created by PIOS agent vs user
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── 2. File items (catalogued files) ────────────────────────────────────────
create table if not exists public.file_items (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  space_id        uuid references public.file_spaces(id) on delete set null,

  -- File identity
  name            text not null,
  file_type       text,                     -- pdf, docx, xlsx, jpg, etc.
  mime_type       text,
  size_bytes      bigint,

  -- Source location
  source          text default 'drive' check (source in ('drive','email','upload','local')),
  drive_file_id   text,                     -- Google Drive file ID
  drive_web_url   text,                     -- Direct view link
  gmail_message_id text,                    -- If sourced from email attachment

  -- AI classification
  ai_category     text check (ai_category in (
    'invoice','contract','report','proposal','correspondence',
    'technical','financial','legal','personal','academic',
    'presentation','spreadsheet','image','other'
  )),
  ai_project_tag  text,                     -- Matched project name
  ai_company_tag  text,                     -- Matched company entity
  ai_summary      text,                     -- One-paragraph AI summary
  ai_confidence   numeric(3,2),             -- 0.00–1.00

  -- Filing state
  filing_status   text default 'unprocessed' check (filing_status in (
    'unprocessed','classified','filed','duplicate','archived','review_needed'
  )),
  is_duplicate    boolean default false,
  duplicate_of    uuid references public.file_items(id),

  -- Metadata
  document_date   date,                     -- Date extracted from document
  tags            text[] default '{}',
  notes           text,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 3. Invoices (extracted invoice data) ────────────────────────────────────
create table if not exists public.invoices (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  file_item_id    uuid references public.file_items(id) on delete set null,
  email_item_id   uuid references public.email_items(id) on delete set null,

  -- Invoice identity
  invoice_number  text,
  invoice_type    text default 'receivable' check (invoice_type in (
    'receivable',   -- money owed TO Douglas / companies
    'payable',      -- money owed BY Douglas / companies
    'payroll',      -- payroll-related
    'expense',      -- expense claim
    'credit_note'
  )),

  -- Parties
  supplier_name   text,
  supplier_email  text,
  client_name     text,
  client_email    text,

  -- Financials
  currency        text default 'GBP',
  subtotal        numeric(14,2),
  tax_amount      numeric(14,2),
  total_amount    numeric(14,2) not null,
  amount_paid     numeric(14,2) default 0,
  amount_due      numeric(14,2),

  -- Dates
  invoice_date    date,
  due_date        date,
  paid_date       date,

  -- Routing
  project_id      uuid references public.projects(id) on delete set null,
  company_entity  text,                     -- Which Sustain entity this belongs to
  expense_category text,
  vat_applicable  boolean default false,
  tax_year        text,                     -- e.g. "2025-26"

  -- Status
  status          text default 'pending' check (status in (
    'pending','approved','paid','overdue','disputed','cancelled'
  )),
  approval_notes  text,
  approved_at     timestamptz,
  approved_by     text,

  -- AI extraction
  ai_extracted    boolean default false,
  ai_confidence   numeric(3,2),
  raw_text        text,                     -- OCR/extracted text from document

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 4. Filing rules ──────────────────────────────────────────────────────────
-- User-defined routing rules: "if email from X → file in Project Y"
create table if not exists public.filing_rules (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  name          text not null,
  description   text,
  is_active     boolean default true,
  priority      integer default 50,         -- Lower = checked first

  -- Trigger conditions (any match = rule fires)
  trigger_type  text not null check (trigger_type in (
    'email_sender', 'email_subject', 'file_name', 'file_type',
    'ai_category', 'drive_folder', 'keyword'
  )),
  trigger_value text not null,              -- e.g. "ahmed@qiddiya.com"
  trigger_match text default 'contains' check (trigger_match in (
    'exact','contains','starts_with','ends_with','regex'
  )),

  -- Actions
  action_type   text not null check (action_type in (
    'file_to_space',    -- Move/link to a file space
    'tag',              -- Apply a tag
    'create_task',      -- Auto-create a task
    'mark_invoice',     -- Flag as invoice for extraction
    'assign_project',   -- Assign to a project
    'notify'            -- Send notification
  )),
  action_value  text,                       -- e.g. space_id, tag name, project_id

  -- Stats
  times_fired   integer default 0,
  last_fired_at timestamptz,

  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── 5. Drive scan sessions ───────────────────────────────────────────────────
create table if not exists public.drive_scans (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  started_at    timestamptz default now(),
  completed_at  timestamptz,
  status        text default 'running' check (status in ('running','completed','failed','cancelled')),
  files_scanned integer default 0,
  files_classified integer default 0,
  invoices_found integer default 0,
  duplicates_found integer default 0,
  scan_path     text,                       -- Which Drive folder was scanned
  error_message text,
  summary       jsonb default '{}'::jsonb
);

-- ── 6. RLS ───────────────────────────────────────────────────────────────────
alter table public.file_spaces  enable row level security;
alter table public.file_items   enable row level security;
alter table public.invoices     enable row level security;
alter table public.filing_rules enable row level security;
alter table public.drive_scans  enable row level security;

create policy "own_spaces"  on public.file_spaces  for all using (auth.uid() = user_id);
create policy "own_files"   on public.file_items   for all using (auth.uid() = user_id);
create policy "own_invoices" on public.invoices    for all using (auth.uid() = user_id);
create policy "own_rules"   on public.filing_rules for all using (auth.uid() = user_id);
create policy "own_scans"   on public.drive_scans  for all using (auth.uid() = user_id);

-- ── 7. Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_file_spaces_user   on public.file_spaces(user_id, parent_id);
create index if not exists idx_file_items_user    on public.file_items(user_id, filing_status);
create index if not exists idx_file_items_drive   on public.file_items(drive_file_id);
create index if not exists idx_invoices_user      on public.invoices(user_id, status, due_date);
create index if not exists idx_filing_rules_user  on public.filing_rules(user_id, is_active, priority);

-- ── 8. Seed: Default file space structure ────────────────────────────────────
do $$
declare
  v_user_id uuid;
  v_projects_id uuid;
  v_company_id  uuid;
  v_academic_id uuid;
  v_finance_id  uuid;
begin
  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then return; end if;

  -- Root spaces
  insert into public.file_spaces (user_id, name, path, space_type, icon, colour, sort_order) values
    (v_user_id, 'Projects',       '/Projects',       'project',  '🗂️', '#6c8eff', 1) returning id into v_projects_id;
  insert into public.file_spaces (user_id, name, path, space_type, icon, colour, sort_order) values
    (v_user_id, 'Company Group',  '/Company',        'company',  '🏢', '#2dd4a0', 2) returning id into v_company_id;
  insert into public.file_spaces (user_id, name, path, space_type, icon, colour, sort_order) values
    (v_user_id, 'Academic — DBA', '/Academic',       'academic', '🎓', '#a78bfa', 3) returning id into v_academic_id;
  insert into public.file_spaces (user_id, name, path, space_type, icon, colour, sort_order) values
    (v_user_id, 'Finance',        '/Finance',        'folder',   '💰', '#f59e0b', 4) returning id into v_finance_id;
  insert into public.file_spaces (user_id, name, path, space_type, icon, colour, sort_order) values
    (v_user_id, 'Personal',       '/Personal',       'personal', '👤', '#64748b', 5);
  insert into public.file_spaces (user_id, name, path, space_type, icon, colour, sort_order) values
    (v_user_id, 'Archive',        '/Archive',        'archive',  '📦', '#475569', 6);

  -- Project sub-spaces
  insert into public.file_spaces (user_id, name, path, space_type, parent_id, icon, colour, sort_order) values
    (v_user_id, 'Qiddiya — QPMO-410',          '/Projects/Qiddiya',      'project', v_projects_id, '🏗️', '#6c8eff', 1),
    (v_user_id, 'King Salman Park (KSP)',        '/Projects/KSP',          'project', v_projects_id, '🌿', '#22c55e', 2),
    (v_user_id, 'SustainEdge Platform',          '/Projects/SustainEdge',  'project', v_projects_id, '⚡', '#6c8eff', 3),
    (v_user_id, 'InvestiScript Platform',        '/Projects/InvestiScript','project', v_projects_id, '🔍', '#e05a7a', 4),
    (v_user_id, 'PIOS Platform',                 '/Projects/PIOS',         'project', v_projects_id, '◉',  '#a78bfa', 5);

  -- Company sub-spaces
  insert into public.file_spaces (user_id, name, path, space_type, parent_id, icon, colour, sort_order) values
    (v_user_id, 'Sustain International FZE (UAE)', '/Company/Sustain-UAE', 'company', v_company_id, '🇦🇪', '#2dd4a0', 1),
    (v_user_id, 'Sustain International UK Ltd',    '/Company/Sustain-UK',  'company', v_company_id, '🇬🇧', '#2dd4a0', 2),
    (v_user_id, 'VeritasIQ Technologies Ltd',      '/Company/VeritasIQ',   'company', v_company_id, '🔐', '#f59e0b', 3);

  -- Finance sub-spaces
  insert into public.file_spaces (user_id, name, path, space_type, parent_id, icon, colour, sort_order) values
    (v_user_id, 'Invoices — Receivable', '/Finance/Invoices/Receivable', 'folder', v_finance_id, '📥', '#22c55e', 1),
    (v_user_id, 'Invoices — Payable',    '/Finance/Invoices/Payable',    'folder', v_finance_id, '📤', '#f59e0b', 2),
    (v_user_id, 'Payroll',               '/Finance/Payroll',             'folder', v_finance_id, '💳', '#a78bfa', 3),
    (v_user_id, 'Expenses',              '/Finance/Expenses',            'folder', v_finance_id, '🧾', '#e05a7a', 4),
    (v_user_id, 'Tax Records',           '/Finance/Tax',                 'folder', v_finance_id, '🏦', '#64748b', 5);

  -- Academic sub-spaces
  insert into public.file_spaces (user_id, name, path, space_type, parent_id, icon, colour, sort_order) values
    (v_user_id, 'Thesis Chapters',    '/Academic/Thesis',      'folder', v_academic_id, '📝', '#a78bfa', 1),
    (v_user_id, 'Literature',         '/Academic/Literature',  'folder', v_academic_id, '📚', '#6c8eff', 2),
    (v_user_id, 'Research Notes',     '/Academic/Notes',       'folder', v_academic_id, '🗒️', '#22d3ee', 3),
    (v_user_id, 'Supervision',        '/Academic/Supervision', 'folder', v_academic_id, '🎓', '#f59e0b', 4);

  -- Seed default filing rules
  insert into public.filing_rules (user_id, name, trigger_type, trigger_value, trigger_match, action_type, action_value, priority) values
    (v_user_id, 'Invoices → Finance/Payable',   'ai_category', 'invoice',      'exact',    'file_to_space', '/Finance/Invoices/Payable',   10),
    (v_user_id, 'Payroll emails',               'email_subject','payroll',      'contains', 'mark_invoice',  'payroll',                     20),
    (v_user_id, 'Qiddiya emails',               'email_sender', 'qiddiya',      'contains', 'assign_project','Qiddiya — QPMO-410',          30),
    (v_user_id, 'KSP documents',               'file_name',    'KSP',          'contains', 'assign_project','King Salman Park (KSP)',       30),
    (v_user_id, 'SustainEdge files',           'file_name',    'SustainEdge',  'contains', 'assign_project','SustainEdge Platform',         30),
    (v_user_id, 'Expense claims',              'email_subject','expense',      'contains', 'mark_invoice',  'expense',                     40),
    (v_user_id, 'PDF contracts',               'file_type',    'pdf',          'exact',    'ai_category',   'auto',                        50);

end $$;

-- ── 9. Verify ────────────────────────────────────────────────────────────────
select
  (select count(*) from public.file_spaces)  as spaces_seeded,
  (select count(*) from public.filing_rules) as rules_seeded;
