-- M056B: Branding & Template System (Week 1 foundation)
-- Tenant-scoped brand settings and document templates for financial documents.

create extension if not exists "pgcrypto";

create table if not exists public.brand_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  company_name text,
  company_logo_url text,
  primary_color text not null default '#0f4c81',
  secondary_color text not null default '#6b7280',
  accent_color text not null default '#d97706',
  font_family text not null default 'system-ui',
  invoice_prefix text not null default 'INV',
  next_invoice_number integer not null default 1001,
  quote_prefix text not null default 'QTE',
  next_quote_number integer not null default 2001,
  proposal_prefix text not null default 'PROP',
  next_proposal_number integer not null default 3001,
  purchase_order_prefix text not null default 'PO',
  next_purchase_order_number integer not null default 4001,
  receipt_prefix text not null default 'RCP',
  next_receipt_number integer not null default 5001,
  email_sender_name text,
  email_reply_to text,
  payment_details jsonb not null default '{}'::jsonb,
  legal_footer text,
  terms_and_conditions text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_settings_tenant_unique unique (tenant_id),
  constraint brand_settings_primary_color_hex check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint brand_settings_secondary_color_hex check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint brand_settings_accent_color_hex check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint brand_settings_next_invoice_number_valid check (next_invoice_number > 0),
  constraint brand_settings_next_quote_number_valid check (next_quote_number > 0),
  constraint brand_settings_next_proposal_number_valid check (next_proposal_number > 0),
  constraint brand_settings_next_purchase_order_number_valid check (next_purchase_order_number > 0),
  constraint brand_settings_next_receipt_number_valid check (next_receipt_number > 0)
);

create index if not exists idx_brand_settings_tenant on public.brand_settings(tenant_id);

create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  document_type text not null,
  name text not null,
  description text,
  is_default boolean not null default false,
  is_system boolean not null default false,
  header_html text,
  items_section_html text,
  totals_section_html text,
  footer_html text,
  include_fields jsonb not null default '{}'::jsonb,
  custom_fields jsonb not null default '[]'::jsonb,
  terms_and_conditions text,
  signature_required boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_templates_type_valid check (document_type in ('invoice','quote','proposal','po','receipt'))
);

create index if not exists idx_document_templates_tenant on public.document_templates(tenant_id);
create index if not exists idx_document_templates_type on public.document_templates(document_type);
create unique index if not exists uq_document_templates_default_per_type
  on public.document_templates(tenant_id, document_type)
  where is_default = true;

alter table public.brand_settings enable row level security;
alter table public.document_templates enable row level security;

drop policy if exists brand_settings_tenant_access on public.brand_settings;
create policy brand_settings_tenant_access on public.brand_settings
  for all
  using (tenant_id = (select tenant_id from public.user_profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from public.user_profiles where id = auth.uid()));

drop policy if exists document_templates_tenant_access on public.document_templates;
create policy document_templates_tenant_access on public.document_templates
  for all
  using (tenant_id = (select tenant_id from public.user_profiles where id = auth.uid()))
  with check (tenant_id = (select tenant_id from public.user_profiles where id = auth.uid()));

insert into public.brand_settings (
  tenant_id,
  company_name,
  email_sender_name,
  email_reply_to,
  payment_details,
  legal_footer,
  terms_and_conditions
)
select
  up.tenant_id,
  coalesce(up.organisation, up.full_name, 'PIOS'),
  coalesce(up.organisation, up.full_name, 'PIOS'),
  au.email,
  '{}'::jsonb,
  'Thank you for your business.',
  'Payment due according to agreed terms.'
from public.user_profiles up
left join auth.users au on au.id = up.id
where up.tenant_id is not null
on conflict (tenant_id) do nothing;

insert into public.document_templates (
  tenant_id,
  created_by,
  updated_by,
  document_type,
  name,
  description,
  is_default,
  is_system,
  include_fields,
  custom_fields,
  terms_and_conditions,
  header_html,
  items_section_html,
  totals_section_html,
  footer_html,
  signature_required
)
select
  bs.tenant_id,
  bs.created_by,
  bs.updated_by,
  'invoice',
  'Professional Invoice',
  'Default branded invoice template',
  true,
  true,
  '{"logo": true, "company_info": true, "customer_contact": true, "items": true, "totals": true, "terms": true, "payment_instructions": true}'::jsonb,
  '[]'::jsonb,
  coalesce(bs.terms_and_conditions, 'Payment due according to agreed terms.'),
  '<div class="document-header"><div class="brand-block">{{company_name}}</div><div class="document-meta">Invoice {{document_number}}</div></div>',
  '<table class="items-table">{{items_rows}}</table>',
  '<div class="totals-block">{{totals}}</div>',
  '<div class="document-footer">{{legal_footer}}</div>',
  false
from public.brand_settings bs
where not exists (
  select 1
  from public.document_templates dt
  where dt.tenant_id = bs.tenant_id
    and dt.document_type = 'invoice'
    and dt.is_default = true
);