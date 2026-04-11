-- M056B: Universal branded document system
-- Extends the Week 1 branding foundation with universal document tables.

create extension if not exists "pgcrypto";

alter table public.brand_settings
  add column if not exists company_legal_name text,
  add column if not exists company_tax_id text,
  add column if not exists company_website text,
  add column if not exists company_phone text,
  add column if not exists company_email text,
  add column if not exists company_address jsonb default '{}'::jsonb,
  add column if not exists logo_url text,
  add column if not exists logo_width integer default 200,
  add column if not exists logo_height integer default 60,
  add column if not exists background_color text default '#ffffff',
  add column if not exists text_color text default '#333333',
  add column if not exists heading_font text default 'system-ui',
  add column if not exists footer_text text,
  add column if not exists bank_details jsonb default '{}'::jsonb,
  add column if not exists email_from_name text,
  add column if not exists email_from_address text,
  add column if not exists next_po_number integer default 4001;

update public.brand_settings
set
  logo_url = coalesce(logo_url, company_logo_url),
  email_from_name = coalesce(email_from_name, email_sender_name, company_name),
  email_from_address = coalesce(email_from_address, email_reply_to, company_email),
  next_po_number = coalesce(next_po_number, next_purchase_order_number, 4001),
  company_address = coalesce(company_address, '{}'::jsonb),
  bank_details = coalesce(bank_details, payment_details, '{}'::jsonb),
  background_color = coalesce(background_color, '#ffffff'),
  text_color = coalesce(text_color, '#333333'),
  heading_font = coalesce(heading_font, font_family, 'system-ui')
where true;

alter table public.brand_settings
  drop constraint if exists brand_settings_primary_color_hex,
  drop constraint if exists brand_settings_secondary_color_hex,
  drop constraint if exists brand_settings_accent_color_hex;

alter table public.brand_settings
  add constraint brand_settings_primary_color_hex check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint brand_settings_secondary_color_hex check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint brand_settings_accent_color_hex check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint brand_settings_background_color_hex check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint brand_settings_text_color_hex check (text_color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.document_templates
  add column if not exists payment_instructions text,
  add column if not exists notes text;

alter table public.document_templates
  drop constraint if exists document_templates_type_valid;

alter table public.document_templates
  add constraint document_templates_type_valid check (document_type in ('invoice','quote','proposal','purchase_order','receipt'));

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  document_type text not null,
  document_number text not null,
  template_id uuid references public.document_templates(id) on delete set null,
  issue_date date not null default current_date,
  due_date date,
  valid_until date,
  from_name text not null,
  from_email text not null,
  from_address jsonb default '{}'::jsonb,
  to_name text not null,
  to_email text not null,
  to_address jsonb default '{}'::jsonb,
  to_phone text,
  to_contact_person text,
  po_number text,
  order_number text,
  reference_number text,
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null,
  currency text not null default 'USD',
  status text not null default 'draft',
  payment_status text,
  quote_status text,
  proposal_status text,
  amount_paid numeric(12,2) not null default 0,
  description text,
  terms_and_conditions text,
  payment_instructions text,
  notes text,
  custom_fields jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint documents_type_valid check (document_type in ('invoice','quote','proposal','purchase_order','receipt')),
  constraint documents_number_tenant_unique unique (tenant_id, document_number),
  constraint documents_total_positive check (total_amount >= 0),
  constraint documents_amount_paid_positive check (amount_paid >= 0)
);

create index if not exists idx_documents_tenant on public.documents(tenant_id);
create index if not exists idx_documents_type on public.documents(document_type);
create index if not exists idx_documents_number on public.documents(document_number);
create index if not exists idx_documents_status on public.documents(status);
create index if not exists idx_documents_created on public.documents(created_at desc);

create table if not exists public.document_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) generated always as (quantity * unit_price) stored,
  category text,
  tax_rate numeric(5,2) not null default 0,
  discount_percent numeric(5,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_items_quantity_positive check (quantity > 0),
  constraint document_items_price_non_negative check (unit_price >= 0),
  constraint document_items_tax_rate_valid check (tax_rate >= 0 and tax_rate <= 100),
  constraint document_items_discount_valid check (discount_percent >= 0 and discount_percent <= 100)
);

create index if not exists idx_document_items_document on public.document_items(document_id);

create table if not exists public.document_recipients (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  recipient_email text not null,
  recipient_name text,
  sent_at timestamptz,
  viewed_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint document_recipients_valid_email check (recipient_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

create index if not exists idx_document_recipients_document on public.document_recipients(document_id);
create index if not exists idx_document_recipients_sent on public.document_recipients(sent_at);

create table if not exists public.document_signatures (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  signer_name text not null,
  signer_email text not null,
  signer_title text,
  signature_url text,
  signature_date date,
  ip_address text,
  user_agent text,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_signatures_document on public.document_signatures(document_id);

create table if not exists public.document_pdfs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  pdf_url text not null,
  pdf_size integer,
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint document_pdfs_document_unique unique (document_id)
);

create index if not exists idx_document_pdfs_document on public.document_pdfs(document_id);

create or replace function public.generate_document_number(
  p_tenant_id uuid,
  p_document_type text
) returns text
language plpgsql
as $$
declare
  settings_row public.brand_settings%rowtype;
  v_prefix text;
  v_next_num integer;
  v_document_number text;
begin
  select *
  into settings_row
  from public.brand_settings
  where tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'Brand settings not found for tenant %', p_tenant_id;
  end if;

  case p_document_type
    when 'invoice' then
      v_prefix := settings_row.invoice_prefix;
      v_next_num := settings_row.next_invoice_number;
      update public.brand_settings
      set next_invoice_number = coalesce(next_invoice_number, 1001) + 1,
          updated_at = now()
      where tenant_id = p_tenant_id;
    when 'quote' then
      v_prefix := settings_row.quote_prefix;
      v_next_num := settings_row.next_quote_number;
      update public.brand_settings
      set next_quote_number = coalesce(next_quote_number, 2001) + 1,
          updated_at = now()
      where tenant_id = p_tenant_id;
    when 'proposal' then
      v_prefix := settings_row.proposal_prefix;
      v_next_num := settings_row.next_proposal_number;
      update public.brand_settings
      set next_proposal_number = coalesce(next_proposal_number, 3001) + 1,
          updated_at = now()
      where tenant_id = p_tenant_id;
    when 'purchase_order' then
      v_prefix := settings_row.purchase_order_prefix;
      v_next_num := coalesce(settings_row.next_po_number, settings_row.next_purchase_order_number, 4001);
      update public.brand_settings
      set next_po_number = coalesce(next_po_number, next_purchase_order_number, 4001) + 1,
          next_purchase_order_number = coalesce(next_purchase_order_number, next_po_number, 4001) + 1,
          updated_at = now()
      where tenant_id = p_tenant_id;
    when 'receipt' then
      v_prefix := settings_row.receipt_prefix;
      v_next_num := settings_row.next_receipt_number;
      update public.brand_settings
      set next_receipt_number = coalesce(next_receipt_number, 5001) + 1,
          updated_at = now()
      where tenant_id = p_tenant_id;
    else
      raise exception 'Unsupported document type: %', p_document_type;
  end case;

  v_document_number := coalesce(v_prefix, upper(left(p_document_type, 3))) || '-' || lpad(coalesce(v_next_num, 1)::text, 4, '0');
  return v_document_number;
end;
$$;

create or replace function public.recalculate_document_totals()
returns trigger
language plpgsql
as $$
declare
  v_document_id uuid;
begin
  v_document_id := coalesce(new.document_id, old.document_id);

  update public.documents
  set subtotal = (
      select coalesce(sum(line_total), 0)
      from public.document_items
      where document_id = v_document_id
    ),
    updated_at = now()
  where id = v_document_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trigger_recalculate_document_totals on public.document_items;
create trigger trigger_recalculate_document_totals
after insert or update or delete on public.document_items
for each row execute function public.recalculate_document_totals();

alter table public.documents enable row level security;
alter table public.document_items enable row level security;
alter table public.document_recipients enable row level security;
alter table public.document_signatures enable row level security;
alter table public.document_pdfs enable row level security;

drop policy if exists documents_tenant_access on public.documents;
create policy documents_tenant_access on public.documents
  for all
  using (tenant_id = public.get_tenant_id())
  with check (tenant_id = public.get_tenant_id());

drop policy if exists document_items_tenant_access on public.document_items;
create policy document_items_tenant_access on public.document_items
  for all
  using (
    document_id in (
      select id from public.documents where tenant_id = public.get_tenant_id()
    )
  )
  with check (
    document_id in (
      select id from public.documents where tenant_id = public.get_tenant_id()
    )
  );

drop policy if exists document_recipients_tenant_access on public.document_recipients;
create policy document_recipients_tenant_access on public.document_recipients
  for all
  using (
    document_id in (
      select id from public.documents where tenant_id = public.get_tenant_id()
    )
  )
  with check (
    document_id in (
      select id from public.documents where tenant_id = public.get_tenant_id()
    )
  );

drop policy if exists document_signatures_tenant_access on public.document_signatures;
create policy document_signatures_tenant_access on public.document_signatures
  for all
  using (
    document_id in (
      select id from public.documents where tenant_id = public.get_tenant_id()
    )
  )
  with check (
    document_id in (
      select id from public.documents where tenant_id = public.get_tenant_id()
    )
  );

drop policy if exists document_pdfs_tenant_access on public.document_pdfs;
create policy document_pdfs_tenant_access on public.document_pdfs
  for all
  using (
    document_id in (
      select id from public.documents where tenant_id = public.get_tenant_id()
    )
  )
  with check (
    document_id in (
      select id from public.documents where tenant_id = public.get_tenant_id()
    )
  );