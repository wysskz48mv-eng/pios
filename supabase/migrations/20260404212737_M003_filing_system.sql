create table if not exists identity_contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  provider text not null check (provider in ('gmail','outlook','icloud','google_drive','onedrive','dropbox','manual')),
  account_email text,
  account_type text default 'personal' check (account_type in ('personal','organisational')),
  zone smallint not null default 4 check (zone in (1,2,3,4)),
  zone_label text generated always as (
    case zone
      when 1 then 'Restricted (corporate)'
      when 2 then 'Controlled (institutional)'
      when 3 then 'Owned (startup/business)'
      when 4 then 'Personal'
    end
  ) stored,
  auto_scan bool default false,
  auto_file bool default false,
  is_active bool default true,
  created_at timestamptz default now(),
  last_synced_at timestamptz
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  identity_context_id uuid references identity_contexts(id),
  anthropic_file_id text,
  storage_path text,
  original_filename text not null,
  generated_filename text,
  file_size_bytes bigint,
  mime_type text,
  file_hash text,
  category text check (category in ('Business','Client','Academic','Personal','Uncategorised')),
  subcategory text,
  document_type text,
  summary text,
  extracted_fields jsonb default '{}',
  tags text[] default '{}',
  source text default 'upload' check (source in ('email','upload','chat','drive')),
  source_email_id text,
  source_email_subject text,
  source_email_sender text,
  status text default 'pending' check (status in ('pending','filed','rejected','quarantined')),
  classification_confidence float,
  filed_at timestamptz,
  sensitivity_level text default 'internal' check (sensitivity_level in ('public','internal','confidential','restricted')),
  pii_detected bool default false,
  corporate_import_acknowledged bool default false,
  cross_border_consent bool default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists document_financials (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade not null,
  amount numeric(12,2),
  currency text default 'GBP',
  vat_amount numeric(12,2),
  due_date date,
  invoice_number text,
  payment_status text check (payment_status in ('paid','unpaid','overdue','unknown')),
  created_at timestamptz default now()
);

create table if not exists document_parties (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade not null,
  role text check (role in ('vendor','client','counterparty','author','supervisor','institution')),
  name text,
  email text,
  organisation text,
  created_at timestamptz default now()
);

create table if not exists document_scan_log (
  id uuid primary key default gen_random_uuid(),
  document_id uuid,
  user_id uuid references auth.users(id) not null,
  identity_context_id uuid,
  scan_timestamp timestamptz default now(),
  file_hash text,
  file_size_bytes bigint,
  file_type_declared text,
  file_type_detected text,
  layers_passed int[] default '{}',
  layers_failed int[] default '{}',
  quarantine_reason text,
  pii_detected bool default false,
  sensitivity_level text,
  prompt_injection_detected bool default false,
  passed bool default false
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  event_type text not null,
  identity_context_id uuid,
  document_id uuid,
  event_data jsonb default '{}',
  ip_address inet,
  created_at timestamptz default now()
);

create table if not exists email_triage_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  identity_context_id uuid references identity_contexts(id),
  gmail_message_id text,
  gmail_thread_id text,
  sender text,
  subject text,
  received_at timestamptz,
  attachment_count int default 0,
  status text default 'queued' check (status in ('queued','processing','filed','dismissed','quarantined')),
  processed_at timestamptz,
  created_at timestamptz default now()
);

alter table identity_contexts enable row level security;
alter table documents enable row level security;
alter table document_financials enable row level security;
alter table document_parties enable row level security;
alter table document_scan_log enable row level security;
alter table audit_log enable row level security;
alter table email_triage_queue enable row level security;

create policy "Users own their identity contexts" on identity_contexts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users own their documents" on documents for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users own their document financials" on document_financials for all using ((select user_id from documents where id = document_id) = auth.uid());
create policy "Users own their document parties" on document_parties for all using ((select user_id from documents where id = document_id) = auth.uid());
create policy "Users read their scan logs" on document_scan_log for select using (user_id = auth.uid());
create policy "Users read their audit log" on audit_log for select using (user_id = auth.uid());
create policy "System inserts audit log" on audit_log for insert with check (user_id = auth.uid());
create policy "Users own their triage queue" on email_triage_queue for all using (user_id = auth.uid()) with check (user_id = auth.uid());;
