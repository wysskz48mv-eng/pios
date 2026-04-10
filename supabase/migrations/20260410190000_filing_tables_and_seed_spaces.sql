-- ============================================================
-- PIOS: Filing system tables + seed default file spaces
-- Creates file_spaces, filing_rules if missing, fixes RLS,
-- and seeds default spaces for existing users
-- ============================================================

-- ── 1. File spaces (virtual folders) ────────────────────────────────────────

create table if not exists public.file_spaces (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  path        text not null,
  icon        text default '📁',
  description text,
  space_type  text default 'custom'
    check (space_type in ('system','custom','project','archive')),
  parent_id   uuid references public.file_spaces(id) on delete set null,
  sort_order  integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists idx_file_spaces_user on public.file_spaces(user_id);
create index if not exists idx_file_spaces_path on public.file_spaces(user_id, path);

-- ── 2. Filing rules (auto-routing) ─────────────────────────────────────────

create table if not exists public.filing_rules (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text,
  trigger_type    text not null check (trigger_type in (
    'email_sender','email_subject','file_name','file_type','ai_category',
    'drive_folder','keyword'
  )),
  trigger_match   text default 'contains' check (trigger_match in (
    'exact','contains','starts_with','ends_with','regex'
  )),
  trigger_value   text not null,
  action_type     text not null check (action_type in (
    'file_to_space','tag','create_task','mark_invoice','assign_project','notify'
  )),
  action_value    text,
  priority        integer default 100,
  is_active       boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_filing_rules_user on public.filing_rules(user_id);

-- ── 3. RLS ──────────────────────────────────────────────────────────────────

do $$ declare t text; begin
  foreach t in array array['file_spaces', 'filing_rules'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%s enable row level security', t);
      -- Drop any old policies
      for t in select policyname from pg_policies where tablename = t loop
        execute format('drop policy if exists "%s" on public.%s', t, t);
      end loop;
    end if;
  end loop;
end $$;

-- Create clean user_id policies
do $$ begin
  if to_regclass('public.file_spaces') is not null then
    execute 'create policy if not exists "file_spaces_own" on public.file_spaces for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
  if to_regclass('public.filing_rules') is not null then
    execute 'create policy if not exists "filing_rules_own" on public.filing_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end $$;

-- ── 4. Seed default file spaces for existing users ──────────────────────────

do $$
declare
  uid uuid;
begin
  for uid in select id from auth.users loop
    -- Only seed if user has no spaces yet
    if not exists (select 1 from public.file_spaces where user_id = uid limit 1) then
      insert into public.file_spaces (user_id, name, path, icon, space_type, sort_order) values
        (uid, 'Projects',  'Projects',  '📂', 'system',  1),
        (uid, 'Company',   'Company',   '🏢', 'system',  2),
        (uid, 'Academic',  'Academic',  '🎓', 'system',  3),
        (uid, 'Finance',   'Finance',   '💰', 'system',  4),
        (uid, 'Personal',  'Personal',  '👤', 'system',  5),
        (uid, 'Contracts', 'Contracts', '📝', 'system',  6),
        (uid, 'Archive',   'Archive',   '📦', 'archive', 7);
    end if;
  end loop;
end $$;

-- ── 5. Auto-seed spaces for new users ───────────────────────────────────────

create or replace function public.handle_new_user_file_spaces()
returns trigger language plpgsql security definer as $$
begin
  insert into public.file_spaces (user_id, name, path, icon, space_type, sort_order) values
    (new.id, 'Projects',  'Projects',  '📂', 'system',  1),
    (new.id, 'Company',   'Company',   '🏢', 'system',  2),
    (new.id, 'Academic',  'Academic',  '🎓', 'system',  3),
    (new.id, 'Finance',   'Finance',   '💰', 'system',  4),
    (new.id, 'Personal',  'Personal',  '👤', 'system',  5),
    (new.id, 'Contracts', 'Contracts', '📝', 'system',  6),
    (new.id, 'Archive',   'Archive',   '📦', 'archive', 7);
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'on_user_created_file_spaces') then
    create trigger on_user_created_file_spaces
      after insert on auth.users
      for each row execute function public.handle_new_user_file_spaces();
  end if;
end $$;

-- ── 6. Seed default filing rules for existing users ─────────────────────────

do $$
declare
  uid uuid;
begin
  for uid in select id from auth.users loop
    if not exists (select 1 from public.filing_rules where user_id = uid limit 1) then
      insert into public.filing_rules (user_id, name, trigger_type, trigger_match, trigger_value, action_type, action_value, priority) values
        (uid, 'Invoices → Finance',       'ai_category', 'exact',    'invoice',     'file_to_space', 'Finance',   10),
        (uid, 'Contracts → Contracts',    'ai_category', 'exact',    'contract',    'file_to_space', 'Contracts', 20),
        (uid, 'Financial → Finance',      'ai_category', 'exact',    'financial',   'file_to_space', 'Finance',   30),
        (uid, 'Academic → Academic',      'ai_category', 'exact',    'academic',    'file_to_space', 'Academic',  40),
        (uid, 'Legal → Contracts',        'ai_category', 'exact',    'legal',       'file_to_space', 'Contracts', 50),
        (uid, 'Proposals → Projects',     'ai_category', 'exact',    'proposal',    'file_to_space', 'Projects',  60),
        (uid, 'Reports → Company',        'ai_category', 'exact',    'report',      'file_to_space', 'Company',   70),
        (uid, 'Personal → Personal',      'ai_category', 'exact',    'personal',    'file_to_space', 'Personal',  80);
    end if;
  end loop;
end $$;
