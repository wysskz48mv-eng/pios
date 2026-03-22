-- Migration 011: Learning Journeys — Universal Programme Tracker
-- Supports DBA, PhD, Masters, Undergrad, CPD, Professional Cert, Short Course
-- Replaces hardcoded DBA-only milestone tracking with persona-configurable journeys
-- PIOS v2.2 | Sprint 21

-- ── Programme personas ────────────────────────────────────────────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS persona           TEXT DEFAULT 'student'
    CHECK (persona IN ('doctoral','masters','undergraduate','cpd_professional','short_course','apprentice','other')),
  ADD COLUMN IF NOT EXISTS cpd_body          TEXT,              -- e.g. 'RICS','ICAEW','CIPD','ACCA','CIMA','CIPS','ICE','IET','GMC'
  ADD COLUMN IF NOT EXISTS cpd_hours_target  INTEGER DEFAULT 0, -- annual hours target
  ADD COLUMN IF NOT EXISTS cpd_hours_done    INTEGER DEFAULT 0, -- YTD hours logged
  ADD COLUMN IF NOT EXISTS study_mode        TEXT DEFAULT 'part_time'
    CHECK (study_mode IN ('full_time','part_time','online','blended','distance')),
  ADD COLUMN IF NOT EXISTS cohort_year       INTEGER,
  ADD COLUMN IF NOT EXISTS supervisor_name   TEXT,
  ADD COLUMN IF NOT EXISTS supervisor_email  TEXT,
  ADD COLUMN IF NOT EXISTS wizard_completed  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS wizard_persona    JSONB DEFAULT '{}'; -- stores full wizard answers

-- ── Universal milestones (replaces dba_milestones concept) ───────────────────
CREATE TABLE IF NOT EXISTS programme_milestones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  persona          TEXT NOT NULL DEFAULT 'student',
  title            TEXT NOT NULL,
  milestone_type   TEXT NOT NULL DEFAULT 'checkpoint',
  category         TEXT NOT NULL DEFAULT 'academic'
                   CHECK (category IN ('academic','cpd','assessment','research','professional','administrative','personal')),
  status           TEXT NOT NULL DEFAULT 'upcoming'
                   CHECK (status IN ('upcoming','in_progress','submitted','passed','failed','deferred','waived','skipped')),
  target_date      DATE,
  completed_date   DATE,
  hours_credit     NUMERIC(6,1) DEFAULT 0,    -- CPD hours this milestone earns
  cpd_type         TEXT,                       -- 'verifiable','non_verifiable'
  cpd_body         TEXT,                       -- which professional body this counts for
  evidence_url     TEXT,                       -- link to certificate/evidence
  notes            TEXT,
  alert_days_before INTEGER DEFAULT 14,
  alert_sent       BOOLEAN DEFAULT false,
  sort_order       INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pm_user_idx     ON programme_milestones(user_id);
CREATE INDEX IF NOT EXISTS pm_status_idx   ON programme_milestones(status);
CREATE INDEX IF NOT EXISTS pm_target_idx   ON programme_milestones(target_date);
CREATE INDEX IF NOT EXISTS pm_category_idx ON programme_milestones(category);

ALTER TABLE programme_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_user_rw" ON programme_milestones
  USING (user_id = auth.uid());

-- ── CPD activity log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cpd_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cpd_body        TEXT,
  title           TEXT NOT NULL,
  activity_type   TEXT NOT NULL DEFAULT 'course'
                  CHECK (activity_type IN (
                    'course','webinar','conference','workshop','reading',
                    'podcast','mentoring','coaching','research','publication',
                    'presentation','committee','volunteering','other'
                  )),
  provider        TEXT,
  hours_verifiable   NUMERIC(5,1) DEFAULT 0,
  hours_non_verifiable NUMERIC(5,1) DEFAULT 0,
  completed_date  DATE,
  cpd_year        INTEGER,
  evidence_url    TEXT,
  reflection      TEXT,
  tags            TEXT[],
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cpda_user_idx  ON cpd_activities(user_id);
CREATE INDEX IF NOT EXISTS cpda_year_idx  ON cpd_activities(cpd_year);
CREATE INDEX IF NOT EXISTS cpda_body_idx  ON cpd_activities(cpd_body);

ALTER TABLE cpd_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpda_user_rw" ON cpd_activities
  USING (user_id = auth.uid());

SELECT 'Migration 011: learning_journeys — programme_milestones + cpd_activities created' AS result;
