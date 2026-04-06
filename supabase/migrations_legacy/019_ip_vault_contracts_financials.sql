-- ============================================================
-- PIOS Sprint 36 — IP Vault · Contract Register · Group Financials
-- M019: ip_assets, contracts, financial_snapshots
-- VeritasIQ Technologies Ltd
-- ============================================================

-- ── 1. IP Vault (IML™ / IP protection) ──────────────────────
create table if not exists public.ip_assets (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  name            text not null,
  asset_type      text not null check (asset_type in (
                    'framework','trademark','patent','trade_secret',
                    'copyright','methodology','process','brand')),
  description     text,
  status          text not null default 'active' check (status in (
                    'active','pending','filed','registered','lapsed','archived')),
  jurisdiction    text[],              -- ['UK','UAE','KSA','US']
  filing_date     date,
  registration_no text,
  renewal_date    date,
  owner_entity    text,                -- 'VeritasIQ Technologies Ltd'
  notes           text,
  tags            text[],
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 2. Contract Register ──────────────────────────────────────
create table if not exists public.contracts (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  title           text not null,
  contract_type   text not null check (contract_type in (
                    'client','supplier','employment','nda','licence',
                    'partnership','lease','service','other')),
  counterparty    text not null,
  status          text not null default 'active' check (status in (
                    'draft','active','expired','terminated','renewed','pending')),
  value           numeric,
  currency        text default 'GBP',
  start_date      date,
  end_date        date,
  auto_renewal    boolean default false,
  notice_period_days integer,
  renewal_date    date,
  key_terms       text,
  obligations     text,
  file_url        text,
  domain          text default 'business',
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 3. Group Financial Snapshots ─────────────────────────────
create table if not exists public.financial_snapshots (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  period          text not null,   -- 'Mar 2026', 'Q1 2026', 'FY2026'
  period_type     text not null default 'month' check (period_type in ('month','quarter','year')),
  entity          text not null default 'group',  -- 'group' or entity name
  revenue         numeric default 0,
  expenses        numeric default 0,
  payroll_cost    numeric default 0,
  gross_profit    numeric generated always as (revenue - expenses - payroll_cost) stored,
  currency        text default 'GBP',
  cash_position   numeric default 0,
  receivables     numeric default 0,
  payables        numeric default 0,
  notes           text,
  ai_commentary   text,
  created_at      timestamptz default now()
);

-- ── 4. RLS ────────────────────────────────────────────────────
alter table public.ip_assets             enable row level security;
alter table public.contracts             enable row level security;
alter table public.financial_snapshots   enable row level security;

do $$ declare t text; begin
  foreach t in array array[
    'ip_assets','contracts','financial_snapshots'
  ] loop
    execute format('
      create policy if not exists "tenant_rls_%s"
        on public.%s for all using (
          tenant_id = (select tenant_id from public.user_profiles where id = auth.uid())
        )', t, t);
  end loop;
end $$;

-- ── 5. Indexes ────────────────────────────────────────────────
create index if not exists idx_ip_assets_user_type    on public.ip_assets(user_id, asset_type);
create index if not exists idx_ip_assets_renewal      on public.ip_assets(renewal_date) where status = 'active';
create index if not exists idx_contracts_user_status  on public.contracts(user_id, status);
create index if not exists idx_contracts_renewal      on public.contracts(renewal_date) where status = 'active';
create index if not exists idx_fin_snapshots_period   on public.financial_snapshots(user_id, period_type, period);
