-- M072: Unify persona mapping, add enum constraint, backfill invalid personas
-- PIOS™ v3.5.0 | Critical Issue: INC-001 Persona Corruption Fix
-- Generated: 2026-04-12

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Create enum type for personas (if not exists)
-- ─────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'persona_enum') THEN
    CREATE TYPE persona_enum AS ENUM (
      'CEO',
      'CONSULTANT',
      'ACADEMIC',
      'CHIEF_OF_STAFF',
      'EXECUTIVE',
      'WHOLE_LIFE'
    );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Backfill invalid personas to valid equivalents
-- ─────────────────────────────────────────────────────────────────────────

-- Map: 'professional' → 'CONSULTANT'
UPDATE user_profiles
SET persona_type = 'CONSULTANT'
WHERE persona_type = 'professional'
  AND persona_type NOT IN ('CEO', 'CONSULTANT', 'ACADEMIC', 'CHIEF_OF_STAFF', 'EXECUTIVE', 'WHOLE_LIFE');

-- Map: 'founder' → 'CEO'
UPDATE user_profiles
SET persona_type = 'CEO'
WHERE persona_type = 'founder'
  AND persona_type NOT IN ('CEO', 'CONSULTANT', 'ACADEMIC', 'CHIEF_OF_STAFF', 'EXECUTIVE', 'WHOLE_LIFE');

-- Map: 'starter' → 'ACADEMIC'
UPDATE user_profiles
SET persona_type = 'ACADEMIC'
WHERE persona_type = 'starter'
  AND persona_type NOT IN ('CEO', 'CONSULTANT', 'ACADEMIC', 'CHIEF_OF_STAFF', 'EXECUTIVE', 'WHOLE_LIFE');

-- Map: 'pro' → 'CONSULTANT'
UPDATE user_profiles
SET persona_type = 'CONSULTANT'
WHERE persona_type = 'pro'
  AND persona_type NOT IN ('CEO', 'CONSULTANT', 'ACADEMIC', 'CHIEF_OF_STAFF', 'EXECUTIVE', 'WHOLE_LIFE');

-- Map: 'enterprise' → 'EXECUTIVE'
UPDATE user_profiles
SET persona_type = 'EXECUTIVE'
WHERE persona_type = 'enterprise'
  AND persona_type NOT IN ('CEO', 'CONSULTANT', 'ACADEMIC', 'CHIEF_OF_STAFF', 'EXECUTIVE', 'WHOLE_LIFE');

-- Map: 'executive' (lowercase) → 'EXECUTIVE'
UPDATE user_profiles
SET persona_type = 'EXECUTIVE'
WHERE persona_type = 'executive'
  AND persona_type NOT IN ('CEO', 'CONSULTANT', 'ACADEMIC', 'CHIEF_OF_STAFF', 'EXECUTIVE', 'WHOLE_LIFE');

-- Map: 'consultant' (lowercase) → 'CONSULTANT'
UPDATE user_profiles
SET persona_type = 'CONSULTANT'
WHERE persona_type = 'consultant'
  AND persona_type NOT IN ('CEO', 'CONSULTANT', 'ACADEMIC', 'CHIEF_OF_STAFF', 'EXECUTIVE', 'WHOLE_LIFE');

-- Map: 'academic' (lowercase) → 'ACADEMIC'
UPDATE user_profiles
SET persona_type = 'ACADEMIC'
WHERE persona_type = 'academic'
  AND persona_type NOT IN ('CEO', 'CONSULTANT', 'ACADEMIC', 'CHIEF_OF_STAFF', 'EXECUTIVE', 'WHOLE_LIFE');

-- Any remaining unknown → default to 'CONSULTANT'
UPDATE user_profiles
SET persona_type = 'CONSULTANT'
WHERE persona_type NOT IN ('CEO', 'CONSULTANT', 'ACADEMIC', 'CHIEF_OF_STAFF', 'EXECUTIVE', 'WHOLE_LIFE');

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Add CHECK constraint (PostgreSQL, not enum cast for compatibility)
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS persona_type_valid;

ALTER TABLE user_profiles
ADD CONSTRAINT persona_type_valid CHECK (
  persona_type IN ('CEO', 'CONSULTANT', 'ACADEMIC', 'CHIEF_OF_STAFF', 'EXECUTIVE', 'WHOLE_LIFE')
);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Set default for new users
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE user_profiles
ALTER COLUMN persona_type SET DEFAULT 'CONSULTANT';

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Create audit log for persona changes (future use)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS persona_change_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_persona TEXT NOT NULL,
  new_persona TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  changed_by TEXT DEFAULT 'system',
  reason TEXT
);

COMMENT ON TABLE persona_change_audit IS 'Audit trail for persona type changes during M072 migration';

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Rollback function (if needed)
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION rollback_persona_migration()
RETURNS TEXT AS $$
BEGIN
  ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS persona_type_valid;
  ALTER TABLE user_profiles ALTER COLUMN persona_type DROP DEFAULT;
  RETURN 'Persona constraint removed. Manual backfill may be needed.';
END;
$$ LANGUAGE plpgsql;
