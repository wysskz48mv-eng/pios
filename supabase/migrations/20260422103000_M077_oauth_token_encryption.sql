-- ============================================================
-- M077: OAuth token encryption metadata + backfill markers
-- Date: 2026-04-22
-- Adds token_encryption_alg to user_profiles and connected_email_accounts
-- so encrypted token rollout is explicit and queryable.
-- ============================================================

alter table if exists public.user_profiles
  add column if not exists token_encryption_alg text not null default 'none';

alter table if exists public.connected_email_accounts
  add column if not exists token_encryption_alg text not null default 'none';

-- Mark rows already encrypted with app-layer envelope format enc:v1:...
update public.user_profiles
set token_encryption_alg = 'aes-256-gcm'
where token_encryption_alg = 'none'
  and (
    coalesce(google_access_token_enc, '') like 'enc:v1:%'
    or coalesce(google_refresh_token_enc, '') like 'enc:v1:%'
  );

update public.connected_email_accounts
set token_encryption_alg = 'aes-256-gcm'
where token_encryption_alg = 'none'
  and (
    coalesce(google_access_token_enc, '') like 'enc:v1:%'
    or coalesce(google_refresh_token_enc, '') like 'enc:v1:%'
    or coalesce(ms_access_token_enc, '') like 'enc:v1:%'
    or coalesce(ms_refresh_token_enc, '') like 'enc:v1:%'
  );

create index if not exists idx_user_profiles_token_encryption_alg
  on public.user_profiles(token_encryption_alg);

create index if not exists idx_connected_email_accounts_token_encryption_alg
  on public.connected_email_accounts(token_encryption_alg);
