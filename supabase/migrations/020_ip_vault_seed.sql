-- ============================================================
-- PIOS Sprint 38 — IP Vault Seed: 15 NemoClaw™ Frameworks
-- M020: Pre-populate ip_assets with all proprietary frameworks
-- Run after M019. Inserts only if not already present.
-- VeritasIQ Technologies Ltd
-- ============================================================

-- Helper: insert framework for every active user who has the Professional persona
-- In practice, run as a one-time seed for the Douglas super-admin user.
-- The API /api/ip-vault (action: seed_frameworks) handles per-user seeding.

-- No-op if table doesn't exist (M019 must run first)
do $$ begin
  if not exists (select 1 from information_schema.tables where table_name = 'ip_assets') then
    raise notice 'M019 not yet run — ip_assets table missing. Run M019 first.';
    return;
  end if;
end $$;

-- Framework definitions for reference (seeded via API for per-user isolation)
-- This migration documents the canonical IP registry.
comment on table public.ip_assets is
  'IP Vault — proprietary frameworks, trademarks, patents. NemoClaw™ suite: SDL, POM, OAE, CVDM, CPA, UMS, VFO, CFE, ADF, GSM, SPA, RTE, IML. VeritasIQ Technologies Ltd.';

-- ── Knowledge Entries table (SE-MIL) ─────────────────────────────────────────
create table if not exists public.knowledge_entries (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  title           text not null,
  summary         text,
  full_text       text,
  entry_type      text not null default 'note' check (entry_type in (
                    'note','article','book','paper','case_study','framework',
                    'lesson_learned','client_insight','market_intelligence',
                    'ai_search_result','other')),
  domain          text not null default 'business' check (domain in (
                    'fm_consulting','academic','saas','business','personal','all')),
  tags            text[] default '{}',
  source          text,
  url             text,
  is_search_result boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.knowledge_entries enable row level security;

do $$ declare t text; begin
  foreach t in array array['knowledge_entries'] loop
    execute format('
      create policy if not exists "tenant_rls_%s"
        on public.%s for all using (
          tenant_id = (select tenant_id from public.user_profiles where id = auth.uid())
        )', t, t);
  end loop;
end $$;

create index if not exists idx_knowledge_user_domain on public.knowledge_entries(user_id, domain);
create index if not exists idx_knowledge_type        on public.knowledge_entries(entry_type);
create index if not exists idx_knowledge_search      on public.knowledge_entries using gin(to_tsvector('english', title || ' ' || coalesce(summary,'')));
