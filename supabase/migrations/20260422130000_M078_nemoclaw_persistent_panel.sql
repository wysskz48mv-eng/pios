-- ============================================================
-- M078: NemoClaw persistent conversation schema
-- Date: 2026-04-22
-- Adds normalized ai_messages table and session metadata fields
-- ============================================================

alter table if exists public.ai_sessions
  add column if not exists domain_mode text default 'general',
  add column if not exists message_count integer not null default 0,
  add column if not exists last_message_at timestamptz,
  add column if not exists context_snapshot jsonb default '{}'::jsonb;

update public.ai_sessions
set
  domain_mode = coalesce(domain_mode, domain, 'general'),
  message_count = coalesce(jsonb_array_length(messages), message_count, 0),
  last_message_at = coalesce(last_message_at, updated_at, created_at)
where true;

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_messages_session_created
  on public.ai_messages(session_id, created_at);
create index if not exists idx_ai_messages_user_created
  on public.ai_messages(user_id, created_at desc);

alter table public.ai_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_messages' and policyname = 'ai_messages_user_access'
  ) then
    create policy "ai_messages_user_access" on public.ai_messages
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Backfill historical ai_sessions.messages arrays into ai_messages once
insert into public.ai_messages (session_id, user_id, role, content, created_at)
select
  s.id,
  s.user_id,
  coalesce((m->>'role')::text, 'assistant') as role,
  coalesce((m->>'content')::text, '') as content,
  coalesce(s.created_at, now()) + ((row_number() over (partition by s.id order by s.created_at) - 1) * interval '1 second') as created_at
from public.ai_sessions s,
  lateral jsonb_array_elements(coalesce(s.messages, '[]'::jsonb)) m
where not exists (
  select 1 from public.ai_messages am where am.session_id = s.id
);

update public.ai_sessions s
set
  message_count = coalesce(t.cnt, 0),
  last_message_at = coalesce(t.last_message_at, s.updated_at, s.created_at)
from (
  select session_id, count(*)::int as cnt, max(created_at) as last_message_at
  from public.ai_messages
  group by session_id
) t
where s.id = t.session_id;
