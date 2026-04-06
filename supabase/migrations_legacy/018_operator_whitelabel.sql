-- ============================================================
-- PIOS Sprint 25 — White-Label Operator Mode
-- M018: operator_configs, okr_notification_prefs
-- VeritasIQ Technologies Ltd
-- ============================================================

-- ── 1. Operator / white-label config ──────────────────────────
-- One row per PIOS deployment (operator = accelerator, PE firm, etc.)
create table if not exists public.operator_configs (
  id                uuid primary key default uuid_generate_v4(),
  operator_name     text not null,
  slug              text unique not null,            -- e.g. 'techstars-london'
  logo_url          text,
  primary_colour    text default '#a78bfa',          -- brand hex
  accent_colour     text default '#22d3ee',
  support_email     text,
  custom_domain     text,                            -- e.g. 'pios.techstars.com'
  -- Feature flags
  features_enabled  text[] default ARRAY[
    'executive_os','consulting','time_sovereignty','comms_hub','intelligence'
  ],
  features_disabled text[] default '{}',
  -- Persona defaults
  default_persona   text default 'executive'
    check (default_persona in ('student','professional','executive','founder','consultant')),
  -- Billing
  plan_override     text,                            -- forces all tenants to this plan
  seats_limit       integer default 50,
  -- Metadata
  active            boolean default true,
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ── 2. Tenant → operator link ──────────────────────────────────
alter table public.tenants
  add column if not exists operator_id uuid references public.operator_configs(id);

-- ── 3. OKR notification preferences ──────────────────────────
create table if not exists public.okr_notification_prefs (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  tenant_id           uuid references public.tenants(id) on delete cascade,
  weekly_digest       boolean default true,
  drift_alerts        boolean default true,
  digest_day          integer default 1       -- 0=Sun 1=Mon … 6=Sat
    check (digest_day between 0 and 6),
  digest_time_utc     time default '07:00',
  email_address       text,                   -- override if different from auth email
  last_sent_at        timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── 4. RLS ────────────────────────────────────────────────────
alter table public.operator_configs      enable row level security;
alter table public.okr_notification_prefs enable row level security;

-- operator_configs: only service role can write; anyone can read their own operator
create policy if not exists "operator_configs_read"
  on public.operator_configs for select using (active = true);

create policy if not exists "okr_prefs_own"
  on public.okr_notification_prefs for all using (auth.uid() = user_id);

-- ── 5. Indexes ────────────────────────────────────────────────
create index if not exists idx_tenants_operator      on public.tenants(operator_id);
create index if not exists idx_okr_prefs_digest_day  on public.okr_notification_prefs(digest_day, weekly_digest);
