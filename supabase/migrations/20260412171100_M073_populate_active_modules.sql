-- M073: Populate active_modules with persona-specific framework defaults
-- PIOS™ v3.5.0 | Critical Issue: Module Assignment Broken
-- Generated: 2026-04-12

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Add constraint to prevent invalid framework codes
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS active_modules_not_null_if_empty;

ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS active_modules_valid;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Create validation function for framework codes
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION validate_framework_codes(codes TEXT[])
RETURNS BOOLEAN AS $$
DECLARE
  valid_codes TEXT[] := ARRAY[
    -- Strategic Leadership (ST)
    'VIQ-ST-01', 'VIQ-ST-02', 'VIQ-ST-03', 'VIQ-ST-07',
    -- Stakeholder Communication (SC)
    'VIQ-SC-01', 'VIQ-SC-02',
    -- Organisational Development (OD)
    'VIQ-OD-01', 'VIQ-OD-02',
    -- Risk & Compliance (RK)
    'VIQ-RK-01',
    -- Process Improvement (PI)
    'VIQ-PI-01',
    -- Financial Analysis (FA)
    'VIQ-FA-01',
    -- Evidence & Evaluation (EV)
    'VIQ-EV-01', 'VIQ-EV-02',
    -- Problem Solving (PS)
    'VIQ-PS-01', 'VIQ-PS-02', 'VIQ-PS-04'
  ];
  code TEXT;
BEGIN
  IF codes IS NULL OR array_length(codes, 1) IS NULL THEN
    RETURN TRUE;  -- Allow NULL or empty
  END IF;

  FOREACH code IN ARRAY codes LOOP
    IF NOT (code = ANY(valid_codes)) THEN
      RETURN FALSE;  -- Invalid code found
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Create trigger to validate framework codes on INSERT/UPDATE
-- ─────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_validate_active_modules ON user_profiles;

DROP FUNCTION IF EXISTS validate_active_modules_trigger();
DROP FUNCTION IF EXISTS enforce_active_modules_validation();

CREATE OR REPLACE FUNCTION validate_active_modules_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT validate_framework_codes(NEW.active_modules) THEN
    RAISE EXCEPTION 'Invalid framework code(s) in active_modules: %',
      (SELECT array_agg(DISTINCT code)
       FROM unnest(NEW.active_modules) AS code
       WHERE NOT validate_framework_codes(ARRAY[code]));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_active_modules
BEFORE INSERT OR UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION validate_active_modules_trigger();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Populate active_modules based on persona defaults
-- ─────────────────────────────────────────────────────────────────────────

-- Create temporary mapping table
CREATE TEMP TABLE persona_framework_defaults AS
SELECT
  'CEO' as persona,
  ARRAY['VIQ-ST-01', 'VIQ-ST-02', 'VIQ-ST-03', 'VIQ-SC-01', 'VIQ-SC-02', 'VIQ-OD-01', 'VIQ-RK-01'] as frameworks
UNION ALL
SELECT
  'CONSULTANT',
  ARRAY['VIQ-PS-01', 'VIQ-PS-02', 'VIQ-ST-01', 'VIQ-SC-01', 'VIQ-FA-01', 'VIQ-EV-01']
UNION ALL
SELECT
  'ACADEMIC',
  ARRAY['VIQ-PS-04', 'VIQ-EV-01', 'VIQ-EV-02', 'VIQ-ST-07']
UNION ALL
SELECT
  'CHIEF_OF_STAFF',
  ARRAY['VIQ-ST-01', 'VIQ-OD-01', 'VIQ-SC-01', 'VIQ-RK-01', 'VIQ-PI-01', 'VIQ-FA-01']
UNION ALL
SELECT
  'EXECUTIVE',
  ARRAY['VIQ-OD-01', 'VIQ-OD-02', 'VIQ-ST-01', 'VIQ-SC-01', 'VIQ-RK-01', 'VIQ-PI-01']
UNION ALL
SELECT
  'WHOLE_LIFE',
  ARRAY[]::TEXT[];

-- Update users with empty or invalid active_modules
UPDATE user_profiles up
SET active_modules = COALESCE(
  (SELECT frameworks FROM persona_framework_defaults WHERE persona = up.persona_type),
  ARRAY[]::TEXT[]
)
WHERE
  -- Update if empty
  (active_modules IS NULL OR array_length(active_modules, 1) IS NULL)
  -- Update if contains invalid codes (like 'professional')
  OR NOT validate_framework_codes(active_modules);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Specific fixes for known issues
-- ─────────────────────────────────────────────────────────────────────────

-- Fix test user: bc8b18d0-8e0d-4eb5-bd15-bbf9c374dbce
-- Had active_modules = ["professional"] and persona_type = 'CEO'
UPDATE user_profiles
SET active_modules = ARRAY['VIQ-ST-01', 'VIQ-ST-02', 'VIQ-ST-03', 'VIQ-SC-01', 'VIQ-SC-02', 'VIQ-OD-01', 'VIQ-RK-01']
WHERE id = 'bc8b18d0-8e0d-4eb5-bd15-bbf9c374dbce'
  AND persona_type = 'CEO';

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Create index for faster lookups
-- ─────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_profiles_active_modules
ON user_profiles USING GIN(active_modules);

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Add comment for future reference
-- ─────────────────────────────────────────────────────────────────────────

COMMENT ON COLUMN user_profiles.active_modules IS
  'Array of VIQ framework codes (e.g., [VIQ-ST-01, VIQ-SC-01]). Populated from persona_configs.default_framework_codes during onboarding. See M073.';

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Rollback function
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION rollback_active_modules_migration()
RETURNS TEXT AS $$
BEGIN
  DROP TRIGGER IF EXISTS trg_validate_active_modules ON user_profiles;
  DROP FUNCTION IF EXISTS validate_active_modules_trigger();
  DROP FUNCTION IF EXISTS validate_framework_codes(TEXT[]);
  DROP INDEX IF EXISTS idx_user_profiles_active_modules;
  RETURN 'Framework validation removed. Manual audit recommended.';
END;
$$ LANGUAGE plpgsql;

commit;
