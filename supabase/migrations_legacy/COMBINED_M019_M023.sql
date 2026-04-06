-- ═══════════════════════════════════════════════════════════════════════════
-- PIOS Combined Migrations M019–M023
-- Supabase Project: vfvfulbcaurqkygjrrhh
-- VeritasIQ Technologies Ltd | March 2026
--
-- All statements are idempotent (IF NOT EXISTS / IF NOT EXISTS) — safe to
-- run multiple times. Paste entire contents into:
--   Supabase → SQL Editor → New Query → Run
--
-- Creates:
--   M019: ip_assets, contracts, financial_snapshots
--   M020: knowledge_entries + IP Vault seed comments
--   M021: wellness_sessions, wellness_streaks, wellness_patterns, purpose_anchors
--   M022: CV columns on user_profiles + nemoclaw_calibration
--   M023: exec_intelligence_config idx, ai_credits_resets
--   Storage: pios-cv bucket for CV uploads
-- ═══════════════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ M019 — IP Vault · Contract Register · Group Financials                 │
-- └─────────────────────────────────────────────────────────────────────────┘

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
  jurisdiction    text[],
  filing_date     date,
  registration_no text,
  renewal_date    date,
  owner_entity    text,
  notes           text,
  tags            text[],
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

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

create table if not exists public.financial_snapshots (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  period          text not null,
  period_type     text not null default 'month' check (period_type in ('month','quarter','year')),
  entity          text not null default 'group',
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

create index if not exists idx_ip_assets_user_type    on public.ip_assets(user_id, asset_type);
create index if not exists idx_ip_assets_renewal      on public.ip_assets(renewal_date) where status = 'active';
create index if not exists idx_contracts_user_status  on public.contracts(user_id, status);
create index if not exists idx_contracts_renewal      on public.contracts(renewal_date) where status = 'active';
create index if not exists idx_fin_snapshots_period   on public.financial_snapshots(user_id, period_type, period);


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ M020 — Knowledge Entries + IP Vault Seed Comments                      │
-- └─────────────────────────────────────────────────────────────────────────┘

do $$ begin
  if not exists (select 1 from information_schema.tables where table_name = 'ip_assets') then
    raise notice 'M019 not yet run — ip_assets table missing. Run M019 first.';
    return;
  end if;
end $$;

comment on table public.ip_assets is
  'IP Vault — proprietary frameworks, trademarks, patents. NemoClaw™ suite: SDL, POM, OAE, CVDM, CPA, UMS, VFO, CFE, ADF, GSM, SPA, RTE, IML. VeritasIQ Technologies Ltd.';

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


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ M021 — Wellness Phase 1                                                │
-- │ wellness_sessions, wellness_streaks, wellness_patterns, purpose_anchors │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS public.wellness_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  session_type    TEXT NOT NULL CHECK (session_type IN (
                    'morning_checkin','evening_review','crisis_support',
                    'energy_audit','focus_block','recovery'
                  )),
  mood_score      SMALLINT CHECK (mood_score BETWEEN 1 AND 10),
  energy_score    SMALLINT CHECK (energy_score BETWEEN 1 AND 10),
  stress_score    SMALLINT CHECK (stress_score BETWEEN 1 AND 10),
  focus_score     SMALLINT CHECK (focus_score BETWEEN 1 AND 10),
  dominant_domain TEXT CHECK (dominant_domain IN (
                    'academic','fm_consulting','saas','business','personal','health'
                  )),
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  ai_insight      TEXT,
  ai_recommended_actions JSONB DEFAULT '[]',
  gdpr_consent    BOOLEAN NOT NULL DEFAULT FALSE,
  data_minimised  BOOLEAN NOT NULL DEFAULT FALSE,
  duration_mins   SMALLINT,
  source          TEXT DEFAULT 'web',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wellness_streaks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  streak_type           TEXT NOT NULL CHECK (streak_type IN (
                          'daily_checkin','morning_routine','focus_blocks',
                          'recovery','sleep_consistency'
                        )),
  current_streak        INTEGER NOT NULL DEFAULT 0,
  longest_streak        INTEGER NOT NULL DEFAULT 0,
  last_activity_date    DATE,
  streak_started_date   DATE,
  total_completions     INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, streak_type)
);

CREATE TABLE IF NOT EXISTS public.wellness_patterns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_type    TEXT NOT NULL CHECK (pattern_type IN (
                    'mood_trend','energy_cycle','stress_trigger',
                    'domain_correlation','recovery_signal','peak_performance'
                  )),
  pattern_label   TEXT NOT NULL,
  pattern_data    JSONB NOT NULL DEFAULT '{}',
  confidence      NUMERIC(4,2) CHECK (confidence BETWEEN 0 AND 1),
  detected_at     TIMESTAMPTZ DEFAULT NOW(),
  valid_until     TIMESTAMPTZ,
  acted_on        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purpose_anchors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  anchor_text     TEXT NOT NULL,
  anchor_type     TEXT NOT NULL CHECK (anchor_type IN (
                    'why','value','goal','mantra','legacy','commitment'
                  )),
  domain          TEXT CHECK (domain IN (
                    'academic','fm_consulting','saas','business','personal','global'
                  )),
  is_primary      BOOLEAN DEFAULT FALSE,
  display_order   SMALLINT DEFAULT 0,
  last_reflected  DATE,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wellness_sessions_user_date
  ON public.wellness_sessions(user_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_wellness_sessions_type
  ON public.wellness_sessions(user_id, session_type);
CREATE INDEX IF NOT EXISTS idx_wellness_streaks_user
  ON public.wellness_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_wellness_patterns_user
  ON public.wellness_patterns(user_id, pattern_type);
CREATE INDEX IF NOT EXISTS idx_purpose_anchors_user
  ON public.purpose_anchors(user_id, is_primary DESC, display_order);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_wellness_sessions_updated ON public.wellness_sessions;
CREATE TRIGGER trg_wellness_sessions_updated
  BEFORE UPDATE ON public.wellness_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_wellness_streaks_updated ON public.wellness_streaks;
CREATE TRIGGER trg_wellness_streaks_updated
  BEFORE UPDATE ON public.wellness_streaks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_purpose_anchors_updated ON public.purpose_anchors;
CREATE TRIGGER trg_purpose_anchors_updated
  BEFORE UPDATE ON public.purpose_anchors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.wellness_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_streaks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_patterns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purpose_anchors    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wellness_sessions_owner" ON public.wellness_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "wellness_streaks_owner" ON public.wellness_streaks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "wellness_patterns_owner" ON public.wellness_patterns
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "purpose_anchors_owner" ON public.purpose_anchors
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.wellness_sessions  IS 'PIOS Wellness Phase 1 — daily check-in sessions with mood/energy/stress scoring';
COMMENT ON TABLE public.wellness_streaks   IS 'PIOS Wellness Phase 1 — habit streak tracking per user per streak type';
COMMENT ON TABLE public.wellness_patterns  IS 'PIOS Wellness Phase 1 — AI-detected patterns from session history';
COMMENT ON TABLE public.purpose_anchors    IS 'PIOS Wellness Phase 1 — user-defined purpose anchors and mantras';


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ M022 — CV Upload + NemoClaw™ Intelligence Calibration                  │
-- └─────────────────────────────────────────────────────────────────────────┘

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS cv_storage_path     text,
  ADD COLUMN IF NOT EXISTS cv_filename         text,
  ADD COLUMN IF NOT EXISTS cv_uploaded_at      timestamptz,
  ADD COLUMN IF NOT EXISTS cv_processing_status text DEFAULT 'none'
    CHECK (cv_processing_status IN ('none','processing','complete','failed'));

CREATE TABLE IF NOT EXISTS nemoclaw_calibration (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),

  education_level     text,
  education_detail    text,
  career_years        int,
  seniority_level     text,
  primary_industry    text,
  industries          text[],
  skills              text[],
  qualifications      text[],
  employers           text[],
  key_achievements    text[],

  communication_register  text DEFAULT 'professional',
  coaching_intensity      text DEFAULT 'balanced',
  recommended_frameworks  text[],
  growth_areas            text[],
  strengths               text[],
  work_life_signals       text,
  decision_style          text,
  performance_baseline    jsonb,

  calibration_summary     text,
  calibration_version     int DEFAULT 1
);

ALTER TABLE nemoclaw_calibration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own calibration"
  ON nemoclaw_calibration FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_nemoclaw_calibration_user
  ON nemoclaw_calibration(user_id);

COMMENT ON TABLE nemoclaw_calibration IS
  'NemoClaw™ Intelligence Calibration — derived from CV analysis. Powers bespoke coaching register, framework selection, and growth profiling. PIOS v3.0 VeritasIQ Technologies Ltd.';


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ M023 — NemoClaw™ Sprint 84: calibration index + AI credits audit       │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE INDEX IF NOT EXISTS idx_nemoclaw_calibration_user_created
  ON nemoclaw_calibration (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_updated
  ON ai_sessions (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_credits_resets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reset_at    timestamptz DEFAULT now(),
  credits_before  int,
  credits_after   int DEFAULT 0,
  reset_reason    text DEFAULT 'monthly_cycle'
);

ALTER TABLE ai_credits_resets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members can view their reset log"
  ON ai_credits_resets FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
    )
  );

ALTER TABLE nemoclaw_calibration
  ADD COLUMN IF NOT EXISTS sidebar_excerpt text
    GENERATED ALWAYS AS (LEFT(calibration_summary, 200)) STORED;

COMMENT ON TABLE ai_credits_resets IS
  'Audit log of monthly AI credit resets per tenant — VeritasIQ Technologies Ltd';


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ Storage: pios-cv bucket for CV uploads                                 │
-- └─────────────────────────────────────────────────────────────────────────┘

INSERT INTO storage.buckets (id, name, public)
VALUES ('pios-cv', 'pios-cv', false)
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- Done. Tables created: ip_assets, contracts, financial_snapshots,
-- knowledge_entries, wellness_sessions, wellness_streaks, wellness_patterns,
-- purpose_anchors, nemoclaw_calibration, ai_credits_resets
-- Columns added: user_profiles.cv_*, nemoclaw_calibration.sidebar_excerpt
-- Bucket: pios-cv
-- ═══════════════════════════════════════════════════════════════════════════
