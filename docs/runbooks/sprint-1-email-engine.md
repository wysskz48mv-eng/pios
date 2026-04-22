# Sprint 1 Email Engine — Production Deployment Runbook (M109)

**Scope:** Deploy async triage classifier pipeline safely for Sprint 1.

**Critical sequencing:** **Functions first → smoke test → secrets (env + vault) → migration M109 → backfill → verification**.

---

## Pre-Deployment Checklist

- [ ] Anthropic API key is available (`ANTHROPIC_API_KEY`, starts with `sk-ant-`)
- [ ] Supabase CLI is installed and authenticated (`supabase login`)
- [ ] Supabase project is linked (`supabase link --project-ref <PROJECT_REF>`)
- [ ] Service role key is retrieved from Supabase dashboard (Project Settings → API)
- [ ] Database backup completed **before** applying M109

---

## 0) One-Time Shell Setup (copy/paste)

```bash
cd /home/ubuntu/nemoclaw_background/github_repos/pios

# REQUIRED: set these for your environment
export PROJECT_REF="<your-project-ref>"
export SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
export SUPABASE_ANON_KEY="<your-anon-key>"
export SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
export ANTHROPIC_API_KEY="<your-anthropic-api-key>"

# Ensure project is linked correctly
supabase link --project-ref "$PROJECT_REF"
```

Expected:
- `supabase link` succeeds without error.

---

## 1) Backup Database (mandatory)

Use either Dashboard backup/snapshot or CLI dump.

```bash
mkdir -p backups
pg_dump "postgresql://postgres:<DB_PASSWORD>@db.${PROJECT_REF}.supabase.co:5432/postgres?sslmode=require" \
  --schema=public --format=custom --file "backups/pre_M109_$(date +%Y%m%d_%H%M%S).dump"
```

Expected:
- Backup file is created under `backups/`.

---

## 2) Deploy Edge Functions FIRST

### 2.1 Deploy `nemoclaw-triage-classifier`

```bash
supabase functions deploy nemoclaw-triage-classifier --project-ref "$PROJECT_REF"
```

Expected:
- Deploy success output with no errors.

### 2.2 Deploy `backfill-email-classification`

```bash
supabase functions deploy backfill-email-classification --project-ref "$PROJECT_REF"
```

Expected:
- Deploy success output with no errors.

### 2.3 Verify function list

```bash
supabase functions list --project-ref "$PROJECT_REF"
```

Expected:
- Both functions visible:
  - `nemoclaw-triage-classifier`
  - `backfill-email-classification`

---

## 3) Set Secrets (Edge env + Vault)

## 3A) Edge Function environment secrets

> Classifier code reads **`ANTHROPIC_API_KEY`** (correct canonical key). Do not use `CLAUDE_API_KEY`.

```bash
supabase secrets set \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  --project-ref "$PROJECT_REF"
```

Expected:
- Secrets set successfully.

## 3B) Vault secrets used by M109 trigger

Run in Supabase SQL Editor:

```sql
-- Replace any existing values to avoid duplicate-name ambiguity
DO $$
BEGIN
  DELETE FROM vault.secrets
  WHERE id IN (
    SELECT id FROM vault.decrypted_secrets
    WHERE name IN ('nemoclaw_classifier_url', 'nemoclaw_service_role_jwt')
  );

  PERFORM vault.create_secret(
    'https://<PROJECT_REF>.supabase.co/functions/v1/nemoclaw-triage-classifier',
    'nemoclaw_classifier_url'
  );

  PERFORM vault.create_secret(
    '<SUPABASE_SERVICE_ROLE_KEY>',
    'nemoclaw_service_role_jwt'
  );
END $$;
```

Then verify in SQL Editor:

```sql
SELECT name
FROM vault.decrypted_secrets
WHERE name IN ('nemoclaw_classifier_url', 'nemoclaw_service_role_jwt')
ORDER BY name;
```

Expected:
- Exactly 2 rows returned.

---

## 4) Smoke Test Classifier BEFORE enabling triggers

### 4.1 Pick one real email id with body and null triage

```sql
SELECT id, sender_email, subject, received_at
FROM public.email_items
WHERE body_text IS NOT NULL
  AND btrim(body_text) <> ''
  AND triage_class IS NULL
ORDER BY received_at DESC
LIMIT 1;
```

Expected:
- One candidate row returned.

### 4.2 Call classifier function directly (replace `<EMAIL_ID>`)

```bash
curl -i -X POST "${SUPABASE_URL}/functions/v1/nemoclaw-triage-classifier" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"emailId":"<EMAIL_ID>"}'
```

Expected:
- HTTP `200`
- JSON includes `{"success":true,...,"classification":{...}}`

### 4.3 Confirm writes happened

```sql
SELECT id, triage_class, priority_score, action_required, urgency, sentiment
FROM public.email_items
WHERE id = '<EMAIL_ID>';

SELECT email_id, triage_class, priority_score, action_required, status, signal_type
FROM public.email_triage_queue
WHERE email_id = '<EMAIL_ID>'
ORDER BY received_at DESC NULLS LAST
LIMIT 1;
```

Expected:
- `email_items.triage_class` is non-null
- Matching queue record exists

---

## 5) Apply Migration M109 (triggers go live now)

```bash
supabase db push --project-ref "$PROJECT_REF"
```

### 5.1 Verify migration status (use migration list, not db diff)

```bash
supabase migration list --project-ref "$PROJECT_REF"
```

Expected:
- `20260423000500_M109_email_management_engine_activation.sql` appears as applied/up.

### 5.2 Verify trigger + trigger function in DB

```sql
SELECT tgname, tgenabled, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgname IN ('email_items_classify_trigger', 'email_items_sender_reputation_trigger')
  AND NOT tgisinternal
ORDER BY tgname;

SELECT proname
FROM pg_proc
WHERE proname IN ('notify_email_classifier', 'update_sender_reputation')
ORDER BY proname;
```

Expected:
- Both triggers present and enabled.
- Both trigger functions present.

---

## 6) Run Backfill (existing 30 emails)

```bash
curl -i -X POST "${SUPABASE_URL}/functions/v1/backfill-email-classification" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"max_emails":30,"batch_size":10,"delay_ms":250}'
```

Expected:
- HTTP `200`
- JSON contains `processed: 30`, `failed: 0` (or very low with explicit failures listed)

---

## 7) Verification Queries (1–9)

Run in SQL Editor after backfill.

### Query 1 — M109 trigger functions exist

```sql
SELECT proname
FROM pg_proc
WHERE proname IN ('notify_email_classifier', 'update_sender_reputation')
ORDER BY proname;
```

Expected:
- 2 rows.

### Query 2 — M109 triggers exist and enabled

```sql
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname IN ('email_items_classify_trigger', 'email_items_sender_reputation_trigger')
  AND NOT tgisinternal
ORDER BY tgname;
```

Expected:
- 2 rows, `tgenabled='O'`.

### Query 3 — Classified email count (Sprint 1 expectation)

```sql
SELECT COUNT(*) AS classified_count
FROM public.email_items
WHERE triage_class IS NOT NULL;
```

Expected:
- **30 rows** after Sprint 1 backfill batch.

### Query 4 — Remaining unclassified emails with body

```sql
SELECT COUNT(*) AS remaining_unclassified_with_body
FROM public.email_items
WHERE body_text IS NOT NULL
  AND btrim(body_text) <> ''
  AND triage_class IS NULL;
```

Expected:
- `0` (for the backfilled cohort).

### Query 5 — Triage queue populated for classified items

```sql
SELECT COUNT(*) AS queue_rows
FROM public.email_triage_queue
WHERE triage_class IS NOT NULL;
```

Expected:
- `>= 30`.

### Query 6 — Distribution by triage class

```sql
SELECT triage_class, COUNT(*) AS cnt
FROM public.email_items
WHERE triage_class IS NOT NULL
GROUP BY triage_class
ORDER BY cnt DESC, triage_class;
```

Expected:
- Non-empty class distribution.

### Query 7 — Sender reputation rows updated

```sql
SELECT COUNT(*) AS sender_reputation_rows
FROM public.sender_reputation;
```

Expected:
- Count increases after inserts/backfill.

### Query 8 — Vault secrets present for trigger runtime

```sql
SELECT name
FROM vault.decrypted_secrets
WHERE name IN ('nemoclaw_classifier_url', 'nemoclaw_service_role_jwt')
ORDER BY name;
```

Expected:
- 2 rows.

### Query 9 — trust_score distribution (with safe fallback)

```sql
-- 9a) Check whether trust_score exists
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'sender_reputation'
    AND column_name = 'trust_score'
) AS has_trust_score;
```

If `has_trust_score = true`, run:

```sql
SELECT trust_score, COUNT(*) AS cnt
FROM public.sender_reputation
GROUP BY trust_score
ORDER BY trust_score;
```

If `has_trust_score = false`, run Sprint-1 proxy distribution:

```sql
SELECT importance, COUNT(*) AS cnt
FROM public.sender_reputation
GROUP BY importance
ORDER BY importance DESC;
```

Expected:
- If `trust_score` exists: distribution returned by `trust_score`.
- Otherwise: proxy distribution returned by `importance`.

---

## 8) Rollback Plan

## Scenario A: Classifier failures after M109 (preferred rollback)

Do **not** roll back schema immediately. Disable triggers first:

```sql
ALTER TABLE public.email_items DISABLE TRIGGER email_items_classify_trigger;
ALTER TABLE public.email_items DISABLE TRIGGER email_items_sender_reputation_trigger;
```

Then fix function/secrets and re-enable:

```sql
ALTER TABLE public.email_items ENABLE TRIGGER email_items_classify_trigger;
ALTER TABLE public.email_items ENABLE TRIGGER email_items_sender_reputation_trigger;
```

## Scenario B: Migration failure during M109 apply

1. Stop deployment pipeline.
2. Restore DB from pre-M109 backup.
3. Re-apply after correcting SQL error in a new migration.

If partially applied and you must detach behavior quickly:

```sql
DROP TRIGGER IF EXISTS email_items_classify_trigger ON public.email_items;
DROP TRIGGER IF EXISTS email_items_sender_reputation_trigger ON public.email_items;
DROP FUNCTION IF EXISTS public.notify_email_classifier();
DROP FUNCTION IF EXISTS public.update_sender_reputation();
```

---

## 9) Troubleshooting

### Error: `Anthropic error 401/403`
- Cause: wrong/expired `ANTHROPIC_API_KEY`
- Fix:
  - Reset secret with `supabase secrets set ANTHROPIC_API_KEY=...`
  - Redeploy `nemoclaw-triage-classifier`

### Error: Trigger warning about missing vault secrets
- Symptom: classifier does not run from trigger, but inserts succeed.
- Fix:
  - Verify `nemoclaw_classifier_url` and `nemoclaw_service_role_jwt` in `vault.decrypted_secrets`
  - Recreate/update secrets exactly with those names

### Error: Function returns 401 when called by trigger
- Cause: bad service-role JWT in vault
- Fix:
  - Update `nemoclaw_service_role_jwt` with current project `service_role` key

### Error: Backfill succeeds with many failures
- Check response `failures[]`
- Re-run backfill for failed subset after fixing root cause
- Lower batch size / increase delay:

```bash
curl -X POST "${SUPABASE_URL}/functions/v1/backfill-email-classification" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"max_emails":30,"batch_size":5,"delay_ms":500}'
```

### Silent failure detection checklist
- Query 2 confirms triggers enabled
- Query 8 confirms vault secrets exist
- Query 3 rises to expected value (30)
- Query 5 has matching queue rows
- If Query 3 stalls while Query 2/8 pass, inspect function logs:

```bash
supabase functions logs nemoclaw-triage-classifier --project-ref "$PROJECT_REF"
supabase functions logs backfill-email-classification --project-ref "$PROJECT_REF"
```

---

## 10) Final Go/No-Go Gate

Go live only when all are true:

- Functions deployed and listed
- Smoke test returns HTTP 200 and writes classification fields
- Vault secrets exist with exact names:
  - `nemoclaw_classifier_url`
  - `nemoclaw_service_role_jwt`
- M109 appears in `supabase migration list`
- Verification Query 3 returns **30**
- No unresolved failures in backfill response/logs

