-- ============================================================
-- PIOS Sprint 24 — SIA™ · BICA™
-- M017: exec intelligence config, board comms, investor updates
-- VeritasIQ Technologies Ltd
-- ============================================================

-- ── 1. Executive intelligence config (SIA™) ──────────────────
-- Extends user_feed_topics — adds exec_priority flag + so_what field
alter table public.user_feed_topics
  add column if not exists exec_priority  boolean default false,
  add column if not exists persona_target text    default 'all'
    check (persona_target in ('all','executive','student','professional'));

-- ── 2. Signal briefs (SIA™ weekly digest) ────────────────────
create table if not exists public.sia_signal_briefs (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid references public.tenants(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  title       text not null,
  cadence     text default 'weekly' check (cadence in ('daily','weekly')),
  content     text not null,          -- full AI-generated brief
  signals     jsonb default '[]',     -- [{title, source, so_what, category}]
  sectors     text[],                 -- sectors covered in this brief
  created_at  timestamptz default now()
);

-- ── 3. Board / investor comms (BICA™) ────────────────────────
create table if not exists public.bica_comms (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  title           text not null,
  comms_type      text not null
    check (comms_type in ('board_update','investor_update','ceo_letter','stakeholder_report','strategy_memo','other')),
  audience        text,
  period          text,                   -- e.g. 'Q1 2026', 'March 2026'
  tone            text default 'formal'
    check (tone in ('formal','confident','balanced','direct')),
  inputs_json     jsonb default '{}',     -- structured inputs used to generate
  content         text,                   -- AI-generated content
  status          text default 'draft'
    check (status in ('draft','reviewed','sent','archived')),
  word_count      integer,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 4. RLS ────────────────────────────────────────────────────
alter table public.sia_signal_briefs  enable row level security;
alter table public.bica_comms         enable row level security;

create policy if not exists "tenant_rls_sia_signal_briefs"
  on public.sia_signal_briefs for all using (
    tenant_id = (select tenant_id from public.user_profiles where id = auth.uid())
  );
create policy if not exists "tenant_rls_bica_comms"
  on public.bica_comms for all using (
    tenant_id = (select tenant_id from public.user_profiles where id = auth.uid())
  );

-- ── 5. Indexes ────────────────────────────────────────────────
create index if not exists idx_sia_briefs_user   on public.sia_signal_briefs(user_id, created_at);
create index if not exists idx_bica_comms_user   on public.bica_comms(user_id, comms_type, status);
