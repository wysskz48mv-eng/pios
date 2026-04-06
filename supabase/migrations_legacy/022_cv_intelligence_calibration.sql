-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 022: CV Upload + NemoClaw™ Intelligence Calibration
-- Adds cv storage, extracted profile data, and calibration profile
-- PIOS v3.0 · VeritasIQ Technologies Ltd
-- ─────────────────────────────────────────────────────────────────────────────

-- Add CV fields to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS cv_storage_path     text,
  ADD COLUMN IF NOT EXISTS cv_filename         text,
  ADD COLUMN IF NOT EXISTS cv_uploaded_at      timestamptz,
  ADD COLUMN IF NOT EXISTS cv_processing_status text DEFAULT 'none'
    CHECK (cv_processing_status IN ('none','processing','complete','failed'));

-- Intelligence calibration profile (NemoClaw™ context layer)
CREATE TABLE IF NOT EXISTS nemoclaw_calibration (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),

  -- Extracted from CV
  education_level     text,         -- 'doctoral','masters','bachelors','professional','other'
  education_detail    text,         -- e.g. 'DBA University of Portsmouth'
  career_years        int,          -- total years of experience
  seniority_level     text,         -- 'c_suite','senior','mid','junior','student'
  primary_industry    text,         -- e.g. 'facilities_management','technology','finance'
  industries          text[],       -- all industries detected
  skills              text[],       -- extracted skills list
  qualifications      text[],       -- professional qualifications (MRICS, MIWFM etc.)
  employers           text[],       -- previous employers extracted
  key_achievements    text[],       -- notable achievements from CV

  -- NemoClaw™ calibration outputs
  communication_register  text DEFAULT 'professional',
    -- 'peer_executive' | 'professional' | 'coached' | 'mentored'
  coaching_intensity      text DEFAULT 'balanced',
    -- 'light' | 'balanced' | 'intensive'
  recommended_frameworks  text[],   -- which of the 13 NemoClaw™ frameworks to lead with
  growth_areas            text[],   -- identified gaps for proactive coaching
  strengths               text[],   -- identified strengths to leverage
  work_life_signals       text,     -- inferred from career pattern
  decision_style          text,     -- 'analytical' | 'intuitive' | 'consultative' | 'directive'
  performance_baseline    jsonb,    -- structured baseline for longitudinal tracking

  -- Calibration summary (shown in NemoClaw™ first message)
  calibration_summary     text,
  calibration_version     int DEFAULT 1
);

-- RLS
ALTER TABLE nemoclaw_calibration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own calibration"
  ON nemoclaw_calibration FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Index
CREATE INDEX IF NOT EXISTS idx_nemoclaw_calibration_user
  ON nemoclaw_calibration(user_id);

-- Storage bucket for CVs (run manually if bucket doesn't exist)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('pios-cv', 'pios-cv', false) ON CONFLICT DO NOTHING;

-- Add cv fields to ALLOWED_FIELDS comment
COMMENT ON TABLE nemoclaw_calibration IS
  'NemoClaw™ Intelligence Calibration — derived from CV analysis. Powers bespoke coaching register, framework selection, and growth profiling. PIOS v3.0 VeritasIQ Technologies Ltd.';
