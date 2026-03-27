-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 023: NemoClaw™ Sprint 84 — calibration index + AI credits audit
-- PIOS v3.0 · Sprint 84 · VeritasIQ Technologies Ltd
-- ─────────────────────────────────────────────────────────────────────────────

-- Fast lookup: latest calibration per user (AI chat fetches this on every call)
CREATE INDEX IF NOT EXISTS idx_nemoclaw_calibration_user_created
  ON nemoclaw_calibration (user_id, created_at DESC);

-- Fast lookup: ai_sessions by user + recency (session sidebar + history load)
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_updated
  ON ai_sessions (user_id, updated_at DESC);

-- AI credits monthly reset audit log
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

-- Allow the nemoclaw_calibration table to store a short excerpt for the
-- sidebar card without re-fetching the full record
ALTER TABLE nemoclaw_calibration
  ADD COLUMN IF NOT EXISTS sidebar_excerpt text
    GENERATED ALWAYS AS (LEFT(calibration_summary, 200)) STORED;

COMMENT ON TABLE ai_credits_resets IS
  'Audit log of monthly AI credit resets per tenant — VeritasIQ Technologies Ltd';
