-- ============================================================
-- PIOS Diagnostics & Self-Learning System
-- Stores findings, tracks recurrence, learns patterns, logs fixes
-- ============================================================

-- ── 1. Diagnostic findings (what the system discovers) ──────────────────────

create table if not exists public.pios_diagnostics (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null,                     -- groups findings from same run
  check_type      text not null,                     -- category of check
  check_name      text not null,                     -- specific check identifier
  severity        text not null default 'info'
    check (severity in ('critical','high','medium','low','info')),
  status          text not null default 'open'
    check (status in ('open','acknowledged','auto_fixed','manually_fixed','wont_fix','recurring')),
  title           text not null,
  detail          text,
  affected_route  text,                              -- e.g. /api/exec
  affected_table  text,                              -- e.g. exec_principles
  evidence        jsonb default '{}'::jsonb,          -- raw proof (error messages, empty counts, etc.)
  fix_applied     text,                              -- what auto-fix was done
  recurrence_count integer default 1,                -- how many times this exact issue was seen
  first_seen_at   timestamptz default now(),
  last_seen_at    timestamptz default now(),
  resolved_at     timestamptz,
  created_at      timestamptz default now()
);

create index if not exists idx_diagnostics_run_id on public.pios_diagnostics(run_id);
create index if not exists idx_diagnostics_status on public.pios_diagnostics(status);
create index if not exists idx_diagnostics_severity on public.pios_diagnostics(severity);
create index if not exists idx_diagnostics_check on public.pios_diagnostics(check_type, check_name);
create index if not exists idx_diagnostics_last_seen on public.pios_diagnostics(last_seen_at desc);

-- No RLS — service role only (cron/admin access)


-- ── 2. Diagnostic patterns (what the system learns) ─────────────────────────

create table if not exists public.pios_diagnostic_patterns (
  id              uuid primary key default gen_random_uuid(),
  pattern_name    text not null unique,              -- e.g. 'rls_tenant_block'
  description     text not null,
  detection_rule  jsonb not null,                    -- how to detect this pattern
  auto_fix_sql    text,                              -- SQL to auto-fix (if possible)
  auto_fix_safe   boolean default false,             -- whether auto-fix is safe to run
  times_detected  integer default 0,
  times_fixed     integer default 0,
  last_detected   timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Seed known patterns from our session
insert into public.pios_diagnostic_patterns (pattern_name, description, detection_rule, auto_fix_sql, auto_fix_safe)
values
  ('rls_tenant_block',
   'RLS policy uses tenant_id instead of user_id, blocking users with NULL tenant_id',
   '{"check": "rls_policy", "match": "tenant_id = (select tenant_id", "fix": "replace with auth.uid() = user_id"}'::jsonb,
   null, false),

  ('api_response_key_mismatch',
   'API returns data under a different key than the frontend expects',
   '{"check": "api_smoke", "symptom": "page shows empty despite data existing"}'::jsonb,
   null, false),

  ('missing_table',
   'Code references a table that does not exist in the database',
   '{"check": "schema_validation", "symptom": "relation does not exist error"}'::jsonb,
   null, false),

  ('column_name_mismatch',
   'Insert/select references a column that does not exist in the table',
   '{"check": "schema_validation", "symptom": "column does not exist or undefined column"}'::jsonb,
   null, false),

  ('tenant_id_hard_block',
   'Route returns 400 No tenant when user_profiles.tenant_id is NULL',
   '{"check": "api_smoke", "symptom": "No tenant error on authenticated request"}'::jsonb,
   null, false),

  ('silent_error_swallow',
   'Frontend catch block swallows errors silently, hiding failures from users and developers',
   '{"check": "code_quality", "match": "catch {}", "fix": "add console.error logging"}'::jsonb,
   null, false),

  ('expired_oauth_token',
   'OAuth token expired and no refresh token available to renew it',
   '{"check": "token_health", "symptom": "token_expiry < now AND refresh_token IS NULL"}'::jsonb,
   null, false),

  ('stale_agent_run',
   'Background agent enabled but has not run in expected timeframe',
   '{"check": "agent_health", "symptom": "enabled=true AND last_run_at older than 2x schedule interval"}'::jsonb,
   null, false)

on conflict (pattern_name) do nothing;


-- ── 3. Diagnostic runs (audit trail) ────────────────────────────────────────

create table if not exists public.pios_diagnostic_runs (
  id              uuid primary key default gen_random_uuid(),
  trigger         text not null default 'cron'
    check (trigger in ('cron','manual','deploy','self_heal')),
  started_at      timestamptz default now(),
  completed_at    timestamptz,
  duration_ms     integer,
  total_checks    integer default 0,
  findings        integer default 0,
  critical        integer default 0,
  high            integer default 0,
  auto_fixed      integer default 0,
  status          text default 'running'
    check (status in ('running','completed','failed'))
);

create index if not exists idx_diagnostic_runs_started on public.pios_diagnostic_runs(started_at desc);
