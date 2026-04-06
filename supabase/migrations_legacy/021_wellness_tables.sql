-- ============================================================
-- M021 — PIOS Wellness Phase 1
-- VeritasIQ Technologies Ltd
-- Tables: wellness_sessions, wellness_streaks, wellness_patterns, purpose_anchors
-- ============================================================

-- ── wellness_sessions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wellness_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  session_type    TEXT NOT NULL CHECK (session_type IN (
                    'morning_checkin','evening_review','crisis_support',
                    'energy_audit','focus_block','recovery'
                  )),
  -- Mood & energy (1–10 scales)
  mood_score      SMALLINT CHECK (mood_score BETWEEN 1 AND 10),
  energy_score    SMALLINT CHECK (energy_score BETWEEN 1 AND 10),
  stress_score    SMALLINT CHECK (stress_score BETWEEN 1 AND 10),
  focus_score     SMALLINT CHECK (focus_score BETWEEN 1 AND 10),
  -- Context
  dominant_domain TEXT CHECK (dominant_domain IN (
                    'academic','fm_consulting','saas','business','personal','health'
                  )),
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  -- AI analysis
  ai_insight      TEXT,
  ai_recommended_actions JSONB DEFAULT '[]',
  -- Consent & privacy
  gdpr_consent    BOOLEAN NOT NULL DEFAULT FALSE,
  data_minimised  BOOLEAN NOT NULL DEFAULT FALSE,
  -- Metadata
  duration_mins   SMALLINT,
  source          TEXT DEFAULT 'web',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── wellness_streaks ──────────────────────────────────────────────────────────
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

-- ── wellness_patterns ─────────────────────────────────────────────────────────
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

-- ── purpose_anchors ───────────────────────────────────────────────────────────
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

-- ── Indexes ───────────────────────────────────────────────────────────────────
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

-- ── Updated_at triggers ───────────────────────────────────────────────────────
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

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.wellness_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_streaks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_patterns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purpose_anchors    ENABLE ROW LEVEL SECURITY;

-- wellness_sessions
CREATE POLICY "wellness_sessions_owner" ON public.wellness_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- wellness_streaks
CREATE POLICY "wellness_streaks_owner" ON public.wellness_streaks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- wellness_patterns
CREATE POLICY "wellness_patterns_owner" ON public.wellness_patterns
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- purpose_anchors
CREATE POLICY "purpose_anchors_owner" ON public.purpose_anchors
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Seed primary purpose anchor template ─────────────────────────────────────
-- (runs only if user_profiles exist — safe no-op otherwise)
COMMENT ON TABLE public.wellness_sessions  IS 'PIOS Wellness Phase 1 — daily check-in sessions with mood/energy/stress scoring';
COMMENT ON TABLE public.wellness_streaks   IS 'PIOS Wellness Phase 1 — habit streak tracking per user per streak type';
COMMENT ON TABLE public.wellness_patterns  IS 'PIOS Wellness Phase 1 — AI-detected patterns from session history';
COMMENT ON TABLE public.purpose_anchors    IS 'PIOS Wellness Phase 1 — user-defined purpose anchors and mantras';
