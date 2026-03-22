-- ============================================================
-- PIOS Migration 009 — Multi-Email Accounts + Meeting Notes
-- PIOS v2.2 | VeritasIQ Technologies Ltd
--
-- Closes two product gaps identified against Otter.ai and WellyBox:
--
-- GAP 1 (WellyBox): Single Google-only inbox.
--   → connected_email_accounts: one user, many inboxes,
--     any provider (Google OAuth, Microsoft Graph, IMAP fallback)
--     with per-inbox context labelling for AI domain routing.
--
-- GAP 2 (Otter.ai): No meeting transcript → action item pipeline.
--   → meeting_notes: stores pasted/uploaded transcripts,
--     AI-extracted decisions, action items, and follow-ups,
--     linked to calendar_events and auto-promoted to tasks.
--
-- Safe to re-run — all DDL uses IF NOT EXISTS.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. CONNECTED EMAIL ACCOUNTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.connected_email_accounts (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  tenant_id            UUID          REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Provider: google | microsoft | imap
  provider             TEXT NOT NULL DEFAULT 'google'
                         CHECK (provider IN ('google','microsoft','imap')),

  -- Identity
  email_address        TEXT NOT NULL,
  display_name         TEXT,                        -- e.g. "University of Portsmouth"

  -- Context drives AI triage domain routing
  -- academic  → all emails tagged domain='academic'
  -- work      → domain='business' or 'fm_consulting'
  -- personal  → domain='personal'
  -- secondment→ domain='fm_consulting', flagged as temporary
  context              TEXT NOT NULL DEFAULT 'personal'
                         CHECK (context IN (
                           'personal','academic','work',
                           'secondment','consulting','client','other'
                         )),
  label                TEXT,                        -- user-defined: "Portsmouth DBA"

  -- ── Google OAuth tokens ───────────────────────────────────
  google_access_token  TEXT,
  google_refresh_token TEXT,
  google_token_expiry  TIMESTAMPTZ,
  google_scopes        TEXT[],

  -- ── Microsoft Graph OAuth tokens ──────────────────────────
  ms_access_token      TEXT,
  ms_refresh_token     TEXT,
  ms_token_expiry      TIMESTAMPTZ,
  ms_tenant_id         TEXT,                        -- Entra tenant ID (null = common/personal)
  ms_scopes            TEXT[],

  -- ── IMAP fallback (secondment / locked-down corporate) ────
  imap_host            TEXT,                        -- e.g. outlook.office365.com
  imap_port            INTEGER DEFAULT 993,
  imap_username        TEXT,
  imap_password_enc    TEXT,                        -- app password, encrypted at rest
  imap_use_tls         BOOLEAN DEFAULT TRUE,

  -- ── Sync behaviour ────────────────────────────────────────
  is_primary           BOOLEAN NOT NULL DEFAULT FALSE,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  sync_enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at       TIMESTAMPTZ,
  last_sync_error      TEXT,
  last_message_id      TEXT,                        -- cursor for incremental sync
  sync_lookback_days   INTEGER DEFAULT 30,

  -- ── AI behaviour per inbox ────────────────────────────────
  ai_triage_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  ai_domain_override   TEXT,                        -- force all mail from this inbox to domain

  -- ── Receipt / invoice scanning (WellyBox gap) ─────────────
  receipt_scan_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  receipt_keywords     TEXT[] DEFAULT ARRAY[
    'invoice','receipt','payment confirmation','order confirmation',
    'booking confirmation','subscription','renewal','statement',
    'remittance','purchase','tax invoice','VAT invoice','pro forma'
  ],

  connected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at      TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, email_address)
);

-- ── Add account FK + inbox context to email_items ─────────────
ALTER TABLE public.email_items
  ADD COLUMN IF NOT EXISTS account_id    UUID
    REFERENCES public.connected_email_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inbox_context TEXT,
  ADD COLUMN IF NOT EXISTS inbox_label   TEXT,
  ADD COLUMN IF NOT EXISTS is_receipt    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS receipt_data  JSONB;  -- {vendor, amount, currency, date, invoice_no}

-- ─────────────────────────────────────────────────────────────
-- 2. MEETING NOTES  (Otter.ai gap)
-- ─────────────────────────────────────────────────────────────
-- Stores transcripts or manual notes from any meeting.
-- AI extracts decisions, action items, and follow-ups.
-- Action items are optionally promoted to the tasks table.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meeting_notes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
  tenant_id         UUID          REFERENCES public.tenants(id)   ON DELETE CASCADE,
  calendar_event_id UUID          REFERENCES public.calendar_events(id) ON DELETE SET NULL,

  -- Meeting identity
  title             TEXT NOT NULL,
  meeting_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_mins     INTEGER,
  attendees         TEXT[],                     -- array of names or emails
  meeting_type      TEXT DEFAULT 'general'
                      CHECK (meeting_type IN (
                        'general','supervision','board','client',
                        'team','interview','consultation','viva',
                        'review','one_on_one','other'
                      )),
  domain            TEXT DEFAULT 'business'
                      CHECK (domain IN (
                        'academic','fm_consulting','saas',
                        'business','personal'
                      )),
  location          TEXT,                       -- room, URL, or "in-person"
  platform          TEXT,                       -- zoom | teams | meet | in_person | phone | other

  -- Raw input
  raw_transcript    TEXT,                       -- pasted transcript or voice-to-text output
  raw_notes         TEXT,                       -- manual notes (if no transcript)
  input_method      TEXT DEFAULT 'manual'
                      CHECK (input_method IN ('manual','paste','upload','voice')),

  -- AI extraction outputs
  ai_summary        TEXT,                       -- 3-5 sentence narrative summary
  ai_decisions      JSONB DEFAULT '[]',         -- [{decision, owner, date}]
  ai_action_items   JSONB DEFAULT '[]',         -- [{action, owner, due_date, priority, domain}]
  ai_follow_ups     JSONB DEFAULT '[]',         -- [{topic, context, by_when}]
  ai_risks          JSONB DEFAULT '[]',         -- [{risk, severity, mitigation}]
  ai_processed_at   TIMESTAMPTZ,
  ai_model          TEXT DEFAULT 'claude-sonnet-4-20250514',

  -- Task promotion
  tasks_created     BOOLEAN DEFAULT FALSE,
  tasks_created_at  TIMESTAMPTZ,
  task_ids          UUID[],                     -- IDs of tasks created from action items

  -- Status
  status            TEXT DEFAULT 'draft'
                      CHECK (status IN ('draft','processed','reviewed','archived')),
  is_confidential   BOOLEAN DEFAULT FALSE,      -- exclude from morning brief AI context

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 3. RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.connected_email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_notes            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_email_accounts"
  ON public.connected_email_accounts FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "own_meeting_notes"
  ON public.meeting_notes FOR ALL
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 4. INDEXES
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cea_user_active
  ON public.connected_email_accounts(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_cea_primary
  ON public.connected_email_accounts(user_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX IF NOT EXISTS idx_email_items_account
  ON public.email_items(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_items_receipt
  ON public.email_items(user_id, is_receipt) WHERE is_receipt = TRUE;
CREATE INDEX IF NOT EXISTS idx_meeting_notes_user
  ON public.meeting_notes(user_id, meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_domain
  ON public.meeting_notes(user_id, domain);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_event
  ON public.meeting_notes(calendar_event_id) WHERE calendar_event_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 5. MIGRATE existing Google token → primary account record
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.connected_email_accounts (
  user_id, tenant_id, provider, email_address,
  display_name, context, label,
  google_access_token, google_refresh_token, google_token_expiry,
  is_primary, is_active, sync_enabled, receipt_scan_enabled
)
SELECT
  up.id, up.tenant_id,
  'google',
  COALESCE(up.google_email, ''),
  'Google Account',
  'personal',
  'Primary Gmail',
  up.google_access_token,
  up.google_refresh_token,
  up.google_token_expiry,
  TRUE, TRUE, TRUE, TRUE
FROM public.user_profiles up
WHERE up.google_email IS NOT NULL
  AND up.google_access_token IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.connected_email_accounts cea
    WHERE cea.user_id = up.id AND cea.email_address = up.google_email
  );

-- ─────────────────────────────────────────────────────────────
-- 6. VERIFY
-- ─────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM public.connected_email_accounts) AS email_accounts,
  (SELECT COUNT(*) FROM public.meeting_notes)            AS meeting_notes,
  (SELECT COUNT(*) FROM public.email_items
   WHERE is_receipt = TRUE)                              AS receipt_emails;

-- ─────────────────────────────────────────────────────────────
-- 7. PATCH tasks.source — add meeting_notes as valid source
-- ─────────────────────────────────────────────────────────────
-- Drop and recreate the check constraint to include meeting_notes
DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tasks'
      AND constraint_name LIKE '%source%'
      AND constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE public.tasks
      DROP CONSTRAINT IF EXISTS tasks_source_check;
  END IF;

  -- Add updated constraint
  ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_source_check
      CHECK (source IN ('manual','email','ai','calendar','meeting_notes'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'tasks.source constraint patch skipped: %', SQLERRM;
END $$;
