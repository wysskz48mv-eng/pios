-- ============================================================
-- Fix email_items: RLS to user_id, add unique constraint
-- Root cause: RLS used tenant_id match, blocking inserts for
-- users with NULL tenant_id. Also missing unique constraint
-- on gmail_message_id needed for upsert.
-- ============================================================

-- Drop ALL existing policies on email_items
do $$ declare pol text; begin
  for pol in
    select policyname from pg_policies where tablename = 'email_items'
  loop
    execute format('drop policy if exists "%s" on public.email_items', pol);
  end loop;
end $$;

-- Create user_id-based policy
alter table public.email_items enable row level security;

create policy "email_items_user_access" on public.email_items
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Add unique constraint on gmail_message_id for upsert
-- (only if it doesn't already exist)
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.email_items'::regclass
    and conname = 'email_items_gmail_message_id_key'
  ) then
    alter table public.email_items
      add constraint email_items_gmail_message_id_key unique (gmail_message_id);
  end if;
end $$;

-- Also fix file_items RLS while we're here (same tenant_id problem)
do $$ declare pol text; begin
  for pol in
    select policyname from pg_policies where tablename = 'file_items'
  loop
    execute format('drop policy if exists "%s" on public.file_items', pol);
  end loop;
end $$;

alter table public.file_items enable row level security;

create policy "file_items_user_access" on public.file_items
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Fix file_spaces too
do $$ declare pol text; begin
  for pol in
    select policyname from pg_policies where tablename = 'file_spaces'
  loop
    execute format('drop policy if exists "%s" on public.file_spaces', pol);
  end loop;
end $$;

alter table public.file_spaces enable row level security;

create policy "file_spaces_user_access" on public.file_spaces
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Fix email_drafts
do $$ declare pol text; begin
  for pol in
    select policyname from pg_policies where tablename = 'email_drafts'
  loop
    execute format('drop policy if exists "%s" on public.email_drafts', pol);
  end loop;
end $$;

alter table public.email_drafts enable row level security;

create policy "email_drafts_user_access" on public.email_drafts
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
