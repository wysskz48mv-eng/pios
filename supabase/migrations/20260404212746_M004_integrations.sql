create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null check (provider in (
    'google_calendar', 'google_gmail',
    'microsoft_outlook', 'microsoft_teams',
    'zoom', 'apple_calendar'
  )),
  account_email text,
  account_name text,
  zone smallint not null default 4,
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  scopes text[] default '{}',
  calendar_ids text[] default '{}',
  is_active bool default true,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, provider, account_email)
);

create table if not exists calendar_events_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  integration_id uuid references integrations(id) on delete cascade not null,
  external_id text not null,
  calendar_id text,
  title text,
  description text,
  start_time timestamptz,
  end_time timestamptz,
  attendees text[] default '{}',
  location text,
  meet_link text,
  status text default 'confirmed',
  synced_at timestamptz default now(),
  unique(user_id, external_id)
);

alter table integrations enable row level security;
alter table calendar_events_cache enable row level security;

drop policy if exists "Users own their integrations" on integrations;
create policy "Users own their integrations" on integrations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users own their calendar cache" on calendar_events_cache;
create policy "Users own their calendar cache" on calendar_events_cache
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());;
