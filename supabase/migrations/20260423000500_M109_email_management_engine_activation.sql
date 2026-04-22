-- ============================================================
-- M109: Sprint 1 - Email Management Engine Activation
-- Date: 2026-04-23
-- Adds async classifier trigger pipeline, missing email classification
-- columns/indexes, and sender reputation auto-tracking.
-- ============================================================

-- Ensure required extensions exist (Supabase-managed schemas)
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- -----------------------------------------------------------------------------
-- 1) email_items: classification + message intelligence columns
-- -----------------------------------------------------------------------------
alter table if exists public.email_items
  add column if not exists sender_domain text,
  add column if not exists urgency text
    check (urgency in ('low', 'medium', 'high', 'urgent')),
  add column if not exists sentiment text
    check (sentiment in ('positive', 'neutral', 'negative', 'urgent')),
  add column if not exists has_body boolean not null default false,
  add column if not exists has_unsubscribe_link boolean not null default false,
  add column if not exists list_unsubscribe_header text,
  add column if not exists auth_results jsonb not null default '{}'::jsonb;

create index if not exists idx_email_items_triage_class on public.email_items(triage_class);
create index if not exists idx_email_items_sender_domain on public.email_items(sender_domain);
create index if not exists idx_email_items_priority on public.email_items(priority_score desc);

-- -----------------------------------------------------------------------------
-- 2) email_triage_queue: fields needed by classifier write path
-- -----------------------------------------------------------------------------
alter table if exists public.email_triage_queue
  add column if not exists email_id uuid references public.email_items(id) on delete cascade,
  add column if not exists triage_class text,
  add column if not exists priority_score integer,
  add column if not exists action_required text,
  add column if not exists sentiment text
    check (sentiment in ('positive', 'neutral', 'negative', 'urgent'));

-- Status supports legacy values + new async pipeline status
alter table if exists public.email_triage_queue
  drop constraint if exists email_triage_queue_status_check;

alter table if exists public.email_triage_queue
  add constraint email_triage_queue_status_check
  check (status in ('queued','processing','filed','dismissed','quarantined','unreviewed'));

-- Normalize urgency options to include medium (for classifier output)
alter table if exists public.email_triage_queue
  drop constraint if exists email_triage_queue_urgency_check;

alter table if exists public.email_triage_queue
  add constraint email_triage_queue_urgency_check
  check (urgency in ('low','medium','high','urgent','normal'));

create index if not exists idx_email_triage_queue_email_id on public.email_triage_queue(email_id);
create index if not exists idx_email_triage_queue_status_priority on public.email_triage_queue(status, priority_score desc);

-- -----------------------------------------------------------------------------
-- 3) sender_reputation: align table with Sprint-1 tracking needs
-- -----------------------------------------------------------------------------
alter table if exists public.sender_reputation
  add column if not exists tenant_id uuid references public.tenants(id) on delete set null,
  add column if not exists last_email_at timestamptz,
  add column if not exists has_list_unsubscribe boolean not null default false,
  add column if not exists is_automated boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

-- -----------------------------------------------------------------------------
-- 3) Trigger function: invoke classifier edge function asynchronously
--
-- Required secrets (configure in SQL editor, not in git):
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/nemoclaw-triage-classifier', 'nemoclaw_classifier_url');
--   select vault.create_secret('<SUPABASE_SERVICE_ROLE_JWT>', 'nemoclaw_service_role_jwt');
-- -----------------------------------------------------------------------------
create or replace function public.notify_email_classifier()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_classifier_url text;
  v_service_jwt text;
begin
  if new.body_text is null or btrim(new.body_text) = '' or new.triage_class is not null then
    return new;
  end if;

  select secret into v_classifier_url
  from vault.decrypted_secrets
  where name = 'nemoclaw_classifier_url'
  limit 1;

  select secret into v_service_jwt
  from vault.decrypted_secrets
  where name = 'nemoclaw_service_role_jwt'
  limit 1;

  if coalesce(v_classifier_url, '') = '' or coalesce(v_service_jwt, '') = '' then
    raise warning 'notify_email_classifier skipped for email %: missing vault secrets', new.id;
    return new;
  end if;

  perform net.http_post(
    url := v_classifier_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_jwt
    ),
    body := jsonb_build_object('emailId', new.id::text)
  );

  return new;
end;
$$;

drop trigger if exists email_items_classify_trigger on public.email_items;
create trigger email_items_classify_trigger
after insert or update of body_text on public.email_items
for each row
when (new.body_text is not null and new.triage_class is null)
execute function public.notify_email_classifier();

-- -----------------------------------------------------------------------------
-- 4) Trigger function: sender_reputation automatic updates
-- -----------------------------------------------------------------------------
create or replace function public.update_sender_reputation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_email text;
  v_sender_domain text;
begin
  v_sender_email := lower(trim(coalesce(new.sender_email, '')));
  if v_sender_email = '' then
    return new;
  end if;

  v_sender_domain := lower(trim(split_part(v_sender_email, '@', 2)));

  insert into public.sender_reputation (
    tenant_id,
    user_id,
    sender_email,
    sender_domain,
    sender_name,
    email_count,
    last_seen,
    last_email_at,
    has_list_unsubscribe,
    is_automated,
    updated_at
  )
  values (
    new.tenant_id,
    new.user_id,
    v_sender_email,
    v_sender_domain,
    nullif(trim(new.sender_name), ''),
    1,
    new.received_at,
    new.received_at,
    coalesce(new.has_unsubscribe_link, false),
    coalesce(new.is_automated, false),
    now()
  )
  on conflict (user_id, sender_email)
  do update set
    tenant_id = coalesce(excluded.tenant_id, sender_reputation.tenant_id),
    email_count = coalesce(sender_reputation.email_count, 0) + 1,
    sender_domain = coalesce(excluded.sender_domain, sender_reputation.sender_domain),
    sender_name = coalesce(excluded.sender_name, sender_reputation.sender_name),
    last_seen = coalesce(excluded.last_seen, sender_reputation.last_seen),
    last_email_at = coalesce(excluded.last_email_at, sender_reputation.last_email_at),
    has_list_unsubscribe = coalesce(excluded.has_list_unsubscribe, false) or coalesce(sender_reputation.has_list_unsubscribe, false),
    is_automated = coalesce(excluded.is_automated, false) or coalesce(sender_reputation.is_automated, false),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists email_items_sender_reputation_trigger on public.email_items;
create trigger email_items_sender_reputation_trigger
after insert on public.email_items
for each row
execute function public.update_sender_reputation();
