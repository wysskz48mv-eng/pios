-- M014: NPS Survey Responses — SRAF D-02 pilot feedback
-- PIOS v2.4.3 | Sprint 56 | VeritasIQ Technologies Ltd

CREATE TABLE IF NOT EXISTS nps_survey_responses (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  platform      TEXT        NOT NULL DEFAULT 'pios',
  stability     NUMERIC(3,1) NOT NULL CHECK (stability   BETWEEN 1 AND 5),
  performance   NUMERIC(3,1) NOT NULL CHECK (performance BETWEEN 1 AND 5),
  security      BOOLEAN     NOT NULL DEFAULT true,
  feature_fit   NUMERIC(3,1) NOT NULL CHECK (feature_fit BETWEEN 1 AND 5),
  nps           INTEGER     NOT NULL CHECK (nps BETWEEN 0 AND 10),
  cps           NUMERIC(4,2) NOT NULL,
  open_feedback TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nps_survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "nps_own_read"   ON nps_survey_responses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "nps_insert_any" ON nps_survey_responses FOR INSERT WITH CHECK (true);

SELECT 'M014: nps_survey_responses ready' AS result;
