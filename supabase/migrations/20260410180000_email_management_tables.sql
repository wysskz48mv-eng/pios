-- ============================================================
-- PIOS Email Management — Phase 1 Enhancement Tables
-- blocked_senders, email_filters, email_actions, snoozed_emails, saved_searches
-- ============================================================

-- ── 1. Blocked senders ──────────────────────────────────────────────────────

create table if not exists public.blocked_senders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text not null,
  domain      text,
  reason      text,
  blocked_at  timestamptz default now(),

  unique (user_id, email)
);

create index if not exists idx_blocked_senders_user on public.blocked_senders(user_id);
create index if not exists idx_blocked_senders_email on public.blocked_senders(email);

alter table public.blocked_senders enable row level security;
create policy "blocked_senders_own" on public.blocked_senders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 2. Email filters / rules ────────────────────────────────────────────────

create table if not exists public.email_filters (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text,
  match_field   text not null check (match_field in ('from', 'subject', 'contains', 'domain', 'to')),
  match_mode    text not null default 'contains' check (match_mode in ('exact', 'contains', 'starts_with', 'ends_with', 'regex')),
  match_value   text not null,
  action        text not null check (action in ('archive', 'spam', 'delete', 'label', 'flag', 'snooze', 'create_task', 'block')),
  action_value  text,
  is_active     boolean default true,
  priority      integer default 100,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_email_filters_user on public.email_filters(user_id);

alter table public.email_filters enable row level security;
create policy "email_filters_own" on public.email_filters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 3. Email actions audit log ──────────────────────────────────────────────

create table if not exists public.email_actions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  email_item_id uuid references public.email_items(id) on delete set null,
  gmail_message_id text,
  action        text not null check (action in (
    'archive', 'unarchive', 'delete', 'spam', 'not_spam',
    'block', 'unblock', 'unsubscribe', 'flag', 'unflag',
    'snooze', 'unsnooze', 'mark_read', 'mark_unread',
    'create_task', 'extract_invoice'
  )),
  action_value  text,
  performed_at  timestamptz default now()
);

create index if not exists idx_email_actions_user on public.email_actions(user_id);
create index if not exists idx_email_actions_email on public.email_actions(email_item_id);

alter table public.email_actions enable row level security;
create policy "email_actions_own" on public.email_actions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 4. Snoozed emails ──────────────────────────────────────────────────────

create table if not exists public.snoozed_emails (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  email_item_id uuid references public.email_items(id) on delete cascade,
  snooze_until  timestamptz not null,
  original_status text,
  created_at    timestamptz default now(),

  unique (user_id, email_item_id)
);

create index if not exists idx_snoozed_user on public.snoozed_emails(user_id);
create index if not exists idx_snoozed_until on public.snoozed_emails(snooze_until);

alter table public.snoozed_emails enable row level security;
create policy "snoozed_own" on public.snoozed_emails
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 5. Saved searches ──────────────────────────────────────────────────────

create table if not exists public.email_saved_searches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  query       text not null,
  created_at  timestamptz default now()
);

alter table public.email_saved_searches enable row level security;
create policy "saved_searches_own" on public.email_saved_searches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 6. Add missing columns to email_items ───────────────────────────────────

alter table public.email_items
  add column if not exists is_flagged boolean default false,
  add column if not exists is_snoozed boolean default false,
  add column if not exists is_spam boolean default false,
  add column if not exists is_blocked boolean default false,
  add column if not exists unsubscribe_url text,
  add column if not exists full_body_fetched boolean default false;
