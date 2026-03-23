-- ============================================================
-- PIOS Migration 012: Trial enforcement + plan_status column
-- Adds plan_status as a proper column (alias for subscription_status),
-- seats_limit if missing, and a trial_active computed helper.
-- PIOS v2.2 | Sprint 28 | VeritasIQ Technologies Ltd
-- ============================================================

-- Add plan_status as a real column synced to subscription_status
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan_status TEXT
    DEFAULT 'trialing'
    CHECK (plan_status IN ('trialing','active','past_due','canceled','paused'));

-- Add seats_limit if not present (referenced by stripe webhook)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS seats_limit INTEGER DEFAULT 1;

-- Back-fill plan_status from subscription_status where it's null
UPDATE public.tenants
  SET plan_status = COALESCE(subscription_status, 'trialing')
  WHERE plan_status IS NULL;

-- Set trial_ends_at = 3 days from now for any tenant where it's null and plan_status = trialing
UPDATE public.tenants
  SET trial_ends_at = NOW() + INTERVAL '3 days'
  WHERE trial_ends_at IS NULL
    AND plan_status = 'trialing';

-- Function: keep plan_status in sync with subscription_status on update
CREATE OR REPLACE FUNCTION sync_plan_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    NEW.plan_status := NEW.subscription_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_sync_plan_status ON public.tenants;
CREATE TRIGGER trig_sync_plan_status
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION sync_plan_status();

-- Function: mark tenant as trial-expired
CREATE OR REPLACE FUNCTION expire_trials()
RETURNS void AS $$
BEGIN
  UPDATE public.tenants
    SET plan_status = 'canceled',
        subscription_status = 'canceled'
    WHERE plan_status = 'trialing'
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at < NOW();
END;
$$ LANGUAGE plpgsql;
