-- ============================================================
-- PIOS Migration 003 — Google token refresh helper
-- Adds a DB function to check if a Google token is expired
-- ============================================================

-- Function: returns true if google_token_expiry is within 5 minutes or past
CREATE OR REPLACE FUNCTION public.google_token_needs_refresh(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT google_token_expiry < NOW() + INTERVAL '5 minutes'
     FROM public.user_profiles WHERE id = user_uuid),
    true
  );
$$;

-- Grant execute to authenticated users (for their own check)
GRANT EXECUTE ON FUNCTION public.google_token_needs_refresh(uuid) TO authenticated;

-- Add index on google_token_expiry for fast expiry checks
CREATE INDEX IF NOT EXISTS idx_user_profiles_token_expiry
  ON public.user_profiles(google_token_expiry)
  WHERE google_token_expiry IS NOT NULL;

-- Verify
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'google_token_needs_refresh';
