-- ============================================================
-- PIOS Sprint 23 — CSA™ · DAA™ · TSA™
-- M016: consulting engagements, decision analysis, time audit
-- VeritasIQ Technologies Ltd
-- ============================================================

-- ── 1. Consulting Engagements (CSA™) ─────────────────────────
create table if not exists public.consulting_engagements (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  client_name     text not null,
  engagement_type text default 'strategy'
    check (engagement_type in ('strategy','operations','change','commercial','diagnostic','other')),
  status          text default 'active'
    check (status in ('active','proposal','on_hold','completed','cancelled')),
  framework_used  text,   -- POM™ | OAE™ | SDL™ | CVDM™ | CPA™ | SCE™ | AAM™
  brief           text,
  ai_output       text,   -- last generated artefact
  start_date      date,
  end_date        date,
  value           numeric,
  currency        text default 'GBP',
  tags            text[],
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 2. Decision options (extends exec_decisions DAA™) ─────────
-- Options are stored as jsonb in exec_decisions.options_json
-- but we also log AI analysis separately for audit trail
create table if not exists public.exec_decision_analyses (
  id              uuid primary key default uuid_generate_v4(),
  decision_id     uuid references public.exec_decisions(id) on delete cascade,
  tenant_id       uuid references public.tenants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  framework_used  text not null,
  analysis_text   text not null,
  recommendation  text,
  confidence      integer check (confidence between 0 and 100),
  created_at      timestamptz default now()
);

-- ── 3. Time audit log (TSA™) ──────────────────────────────────
create table if not exists public.exec_time_audits (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  week_start      date not null,
  strategic_hours numeric default 0,
  operational_hours numeric default 0,
  admin_hours     numeric default 0,
  stakeholder_hours numeric default 0,
  recovery_hours  numeric default 0,
  total_hours     numeric default 0,
  strategic_pct   integer generated always as (
    case when total_hours > 0
    then round((strategic_hours / total_hours) * 100)
    else 0 end
  ) stored,
  ai_commentary   text,
  recommendations text[],
  created_at      timestamptz default now()
);

-- ── 4. RLS ────────────────────────────────────────────────────
alter table public.consulting_engagements    enable row level security;
alter table public.exec_decision_analyses    enable row level security;
alter table public.exec_time_audits          enable row level security;

do $$ declare t text; begin
  foreach t in array array[
    'consulting_engagements','exec_decision_analyses','exec_time_audits'
  ] loop
    execute format('
      create policy if not exists "tenant_rls_%s"
        on public.%s for all using (
          tenant_id = (select tenant_id from public.user_profiles where id = auth.uid())
        )', t, t);
  end loop;
end $$;

-- ── 5. Indexes ────────────────────────────────────────────────
create index if not exists idx_consulting_user_status on public.consulting_engagements(user_id, status);
create index if not exists idx_daa_decision           on public.exec_decision_analyses(decision_id);
create index if not exists idx_tsa_week               on public.exec_time_audits(user_id, week_start);
