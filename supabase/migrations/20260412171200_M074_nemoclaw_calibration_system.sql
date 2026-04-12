-- M074: Add NemoClaw calibration tracking, CV processing status, and nemoclaw_calibration table
-- PIOS™ v3.5.0 | Critical Issue: NemoClaw Activation Path Incomplete
-- Generated: 2026-04-12

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Add NemoClaw calibration columns to user_profiles
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS nemoclaw_calibrated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS nemoclaw_calibrated_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE user_profiles
ALTER COLUMN nemoclaw_calibrated SET DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Create nemoclaw_calibration table (stores extracted CV data)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nemoclaw_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- CV metadata
  cv_storage_path TEXT,
  cv_filename TEXT,
  cv_uploaded_at TIMESTAMP WITH TIME ZONE,

  -- Extracted calibration data
  extracted_data JSONB,
  processed_at TIMESTAMP WITH TIME ZONE,

  -- Status tracking
  status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nemoclaw_calibration_user_id
ON nemoclaw_calibration(user_id);

CREATE INDEX IF NOT EXISTS idx_nemoclaw_calibration_status
ON nemoclaw_calibration(status);

COMMENT ON TABLE nemoclaw_calibration IS
  'Stores CV-extracted calibration data for NemoClaw initialization. Populated by cv-ingestion-pipeline edge function.';

COMMENT ON COLUMN nemoclaw_calibration.extracted_data IS
  'JSON object with: current_role, industry, seniority_level, key_strengths, growth_areas, communication_style, etc.';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Create trigger to update nemoclaw_calibrated in user_profiles
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_nemoclaw_calibration_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE user_profiles
    SET
      nemoclaw_calibrated = TRUE,
      nemoclaw_calibrated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;

  IF NEW.status = 'failed' THEN
    UPDATE user_profiles
    SET nemoclaw_calibrated = FALSE
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_nemoclaw_on_calibration_update ON nemoclaw_calibration;

CREATE TRIGGER trg_sync_nemoclaw_on_calibration_update
AFTER INSERT OR UPDATE ON nemoclaw_calibration
FOR EACH ROW
EXECUTE FUNCTION sync_nemoclaw_calibration_status();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Enable RLS on nemoclaw_calibration
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE nemoclaw_calibration ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own nemoclaw calibration" ON nemoclaw_calibration;
CREATE POLICY "Users see own nemoclaw calibration"
ON nemoclaw_calibration
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage nemoclaw calibration" ON nemoclaw_calibration;
CREATE POLICY "Service role can manage nemoclaw calibration"
ON nemoclaw_calibration
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Backfill nemoclaw_calibration records for existing users with CV
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO nemoclaw_calibration (user_id, cv_storage_path, cv_filename, cv_uploaded_at, status, created_at, updated_at)
SELECT
  id,
  cv_storage_path,
  cv_filename,
  cv_uploaded_at,
  CASE
    WHEN cv_processing_status = 'completed' THEN 'completed'
    WHEN cv_processing_status = 'pending'   THEN 'pending'
    WHEN cv_processing_status = 'processing' THEN 'processing'
    ELSE 'pending'
  END,
  COALESCE(cv_uploaded_at, NOW()),
  NOW()
FROM user_profiles
WHERE cv_storage_path IS NOT NULL
  AND cv_filename IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Backfill nemoclaw_calibrated flag for completed users
-- ─────────────────────────────────────────────────────────────────────────

UPDATE user_profiles up
SET
  nemoclaw_calibrated = TRUE,
  nemoclaw_calibrated_at = COALESCE(up.cv_uploaded_at, NOW())
WHERE
  up.cv_storage_path IS NOT NULL
  AND up.cv_processing_status = 'completed'
  AND up.nemoclaw_calibrated = FALSE;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Add enum-style check for cv_processing_status
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS cv_processing_status_valid;

ALTER TABLE user_profiles
ADD CONSTRAINT cv_processing_status_valid CHECK (
  cv_processing_status IS NULL
  OR cv_processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')
);

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Add monitoring function
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_cv_processing_status(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'user_id', up.id,
    'cv_uploaded', up.cv_uploaded_at IS NOT NULL,
    'nemoclaw_calibrated', up.nemoclaw_calibrated,
    'calibration_status', nc.status,
    'error', nc.error_message,
    'extracted_data_available', nc.extracted_data IS NOT NULL,
    'last_update', GREATEST(
      COALESCE(up.updated_at, '1970-01-01'::timestamptz),
      COALESCE(nc.updated_at, '1970-01-01'::timestamptz)
    )
  ) INTO result
  FROM user_profiles up
  LEFT JOIN nemoclaw_calibration nc ON up.id = nc.user_id
  WHERE up.id = p_user_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Rollback function
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION rollback_nemoclaw_calibration_migration()
RETURNS TEXT AS $$
BEGIN
  DROP TRIGGER IF EXISTS trg_sync_nemoclaw_on_calibration_update ON nemoclaw_calibration;
  DROP FUNCTION IF EXISTS sync_nemoclaw_calibration_status();
  DROP FUNCTION IF EXISTS get_cv_processing_status(UUID);

  ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS cv_processing_status_valid,
  DROP COLUMN IF EXISTS nemoclaw_calibrated,
  DROP COLUMN IF EXISTS nemoclaw_calibrated_at;

  DROP TABLE IF EXISTS nemoclaw_calibration;

  RETURN 'NemoClaw calibration system removed.';
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────
-- 10. Final consistency check
-- ─────────────────────────────────────────────────────────────────────────

-- Remove orphaned nemoclaw records (users deleted from auth.users)
DELETE FROM nemoclaw_calibration
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Fix any inverted timestamps
UPDATE nemoclaw_calibration
SET created_at = LEAST(
  COALESCE(cv_uploaded_at, NOW()),
  COALESCE(created_at, NOW())
)
WHERE created_at IS NULL OR created_at > cv_uploaded_at;
