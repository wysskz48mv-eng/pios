begin;

-- ============================================================
-- M083: Foundational persona system + module activation substrate
-- Date: 2026-04-22
-- Notes:
--   - Aligns with canonical uppercase persona/module codes.
--   - Keeps legacy user_personas columns for backward compatibility.
--   - Introduces user_modules and profile-level activation arrays.
-- ============================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------
-- 1) Upgrade existing user_personas table to multi-persona model
-- -----------------------------------------------------------------
create table if not exists public.user_personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  persona_type text not null,
  is_primary boolean not null default false,
  activated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_personas
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists persona_type text,
  add column if not exists is_primary boolean not null default false,
  add column if not exists activated_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Backfill core columns from legacy schema where present
update public.user_personas
set
  persona_type = coalesce(persona_type, upper(primary_persona)),
  is_primary = coalesce(is_primary, true),
  activated_at = coalesce(activated_at, nemoclaw_activated_at, created_at, now()),
  metadata = coalesce(metadata, '{}'::jsonb)
where persona_type is null;

-- Ensure id is always present
update public.user_personas
set id = gen_random_uuid()
where id is null;

-- Replace legacy PK(user_id) with PK(id) to support multiple personas per user
alter table public.user_personas drop constraint if exists user_personas_pkey;
alter table public.user_personas add constraint user_personas_pkey primary key (id);

-- Persona constraints + helpful uniqueness
alter table public.user_personas drop constraint if exists user_personas_persona_type_check;
alter table public.user_personas
  add constraint user_personas_persona_type_check
  check (persona_type in ('CEO', 'ACADEMIC', 'CONSULTANT', 'EXECUTIVE', 'CHIEF_OF_STAFF', 'WHOLE_LIFE'));

create unique index if not exists idx_user_personas_user_persona_unique
  on public.user_personas(user_id, persona_type);

create unique index if not exists idx_user_personas_primary_unique
  on public.user_personas(user_id)
  where is_primary = true;

create index if not exists idx_user_personas_user_id
  on public.user_personas(user_id);

-- -----------------------------------------------------------------
-- 2) Create user_modules table
-- -----------------------------------------------------------------
create table if not exists public.user_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_code text not null,
  is_active boolean not null default true,
  activated_at timestamptz,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_modules_module_code_check check (module_code ~ '^[A-Z0-9_]+$')
);

create unique index if not exists idx_user_modules_user_module_unique
  on public.user_modules(user_id, module_code);

create index if not exists idx_user_modules_user_id
  on public.user_modules(user_id);

-- -----------------------------------------------------------------
-- 3) Profile-level activation arrays
-- -----------------------------------------------------------------
alter table public.user_profiles
  add column if not exists active_personas text[] not null default '{}'::text[],
  add column if not exists active_module_codes text[] not null default '{}'::text[],
  add column if not exists workload_tracking_enabled boolean not null default false;

create index if not exists idx_user_profiles_active_personas
  on public.user_profiles using gin(active_personas);

create index if not exists idx_user_profiles_active_module_codes
  on public.user_profiles using gin(active_module_codes);

comment on column public.user_profiles.active_modules is
  'Legacy framework-code array (VIQ-*). Kept for backward compatibility.';
comment on column public.user_profiles.active_module_codes is
  'Activated platform module codes (e.g. CONSULTING_HUB, ACADEMIC, CPD, FM_CONSULTANT, RIBA, CITATION_GRAPH).';

-- -----------------------------------------------------------------
-- 4) Persona→module defaults (neutral-first, FM gated)
-- -----------------------------------------------------------------
-- Seed primary persona rows from user_profiles where missing
insert into public.user_personas (id, user_id, persona_type, is_primary, activated_at, metadata, created_at, updated_at)
select
  gen_random_uuid(),
  up.id,
  upper(coalesce(up.persona_type, 'EXECUTIVE')),
  true,
  now(),
  case
    when lower(coalesce(up.consulting_context, '')) like '%fm%'
      then jsonb_build_object('consultant_variant', 'FM_CONSULTANT')
    else '{}'::jsonb
  end,
  now(),
  now()
from public.user_profiles up
where upper(coalesce(up.persona_type, 'EXECUTIVE')) in ('CEO', 'ACADEMIC', 'CONSULTANT', 'EXECUTIVE', 'CHIEF_OF_STAFF', 'WHOLE_LIFE')
  and not exists (
    select 1
    from public.user_personas p
    where p.user_id = up.id
      and p.persona_type = upper(coalesce(up.persona_type, 'EXECUTIVE'))
  );

-- Rebuild module activations from current persona rows
with persona_modules as (
  select up.user_id, 'CONSULTING_HUB'::text as module_code, true as is_active, '{}'::jsonb as config
  from public.user_personas up
  where up.persona_type in ('CEO', 'EXECUTIVE', 'CONSULTANT')

  union all

  select up.user_id, 'ACADEMIC'::text, true, '{}'::jsonb
  from public.user_personas up
  where up.persona_type = 'ACADEMIC'

  union all

  select up.user_id, 'CITATION_GRAPH'::text, true, '{}'::jsonb
  from public.user_personas up
  where up.persona_type = 'ACADEMIC'

  union all

  select up.user_id, 'CPD'::text, true, '{}'::jsonb
  from public.user_personas up
  where up.persona_type in ('ACADEMIC', 'CONSULTANT')

  union all

  select up.user_id, 'FM_CONSULTANT'::text, true,
    jsonb_build_object('source', 'persona_metadata')
  from public.user_personas up
  where up.persona_type = 'CONSULTANT'
    and coalesce(up.metadata->>'consultant_variant', '') = 'FM_CONSULTANT'

  union all

  select up.user_id, 'RIBA'::text, true,
    jsonb_build_object('gated', true, 'source', 'persona_metadata')
  from public.user_personas up
  where up.persona_type in ('CONSULTANT', 'EXECUTIVE', 'ACADEMIC')
    and coalesce((up.metadata->>'riba_enabled')::boolean, false)
)
insert into public.user_modules (id, user_id, module_code, is_active, activated_at, config, created_at, updated_at)
select
  gen_random_uuid(),
  pm.user_id,
  pm.module_code,
  pm.is_active,
  now(),
  pm.config,
  now(),
  now()
from persona_modules pm
on conflict (user_id, module_code) do update
set
  is_active = excluded.is_active,
  activated_at = coalesce(public.user_modules.activated_at, excluded.activated_at),
  config = coalesce(public.user_modules.config, '{}'::jsonb) || excluded.config,
  updated_at = now();

-- Profile rollup cache
update public.user_profiles up
set
  active_personas = coalesce((
    select array_agg(distinct p.persona_type)
    from public.user_personas p
    where p.user_id = up.id
  ), '{}'::text[]),
  active_module_codes = coalesce((
    select array_agg(distinct m.module_code)
    from public.user_modules m
    where m.user_id = up.id
      and m.is_active = true
  ), '{}'::text[]),
  updated_at = now();

-- -----------------------------------------------------------------
-- 5) RLS policies
-- -----------------------------------------------------------------
alter table public.user_personas enable row level security;
alter table public.user_modules enable row level security;

drop policy if exists user_personas_select_own on public.user_personas;
create policy user_personas_select_own
  on public.user_personas
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_personas_insert_own on public.user_personas;
create policy user_personas_insert_own
  on public.user_personas
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_personas_update_own on public.user_personas;
create policy user_personas_update_own
  on public.user_personas
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_personas_delete_own on public.user_personas;
create policy user_personas_delete_own
  on public.user_personas
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_modules_select_own on public.user_modules;
create policy user_modules_select_own
  on public.user_modules
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_modules_insert_own on public.user_modules;
create policy user_modules_insert_own
  on public.user_modules
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_modules_update_own on public.user_modules;
create policy user_modules_update_own
  on public.user_modules
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_modules_delete_own on public.user_modules;
create policy user_modules_delete_own
  on public.user_modules
  for delete
  to authenticated
  using (auth.uid() = user_id);

commit;
