-- Migration 010: DBA Programme Milestones
-- Tracks formal DBA progression milestones with supervisor notification triggers
-- PIOS v2.2 | Sprint 21

CREATE TABLE IF NOT EXISTS dba_milestones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title           TEXT NOT NULL,
  milestone_type  TEXT NOT NULL DEFAULT 'checkpoint'
                  CHECK (milestone_type IN (
                    'registration','ethics_approval','literature_review',
                    'research_proposal','upgrade','data_collection','analysis',
                    'thesis_submission','viva','corrections','award','other'
                  )),
  status          TEXT NOT NULL DEFAULT 'upcoming'
                  CHECK (status IN ('upcoming','in_progress','submitted','passed','failed','deferred','waived')),
  target_date     DATE,
  completed_date  DATE,
  supervisor_name TEXT,
  supervisor_email TEXT,
  institution     TEXT,
  notes           TEXT,
  alert_sent      BOOLEAN DEFAULT false,
  alert_days_before INTEGER DEFAULT 14,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dm_user_idx      ON dba_milestones(user_id);
CREATE INDEX IF NOT EXISTS dm_status_idx    ON dba_milestones(status);
CREATE INDEX IF NOT EXISTS dm_target_idx    ON dba_milestones(target_date);

ALTER TABLE dba_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milestones_user_rw" ON dba_milestones
  USING (user_id = auth.uid());

SELECT 'Migration 010: dba_milestones created' AS result;
