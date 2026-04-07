create table if not exists public.onboarding_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  step integer not null default 0 check (step between 0 and 3),
  persona text check (persona in ('starter', 'pro', 'executive', 'enterprise')),
  goals text,
  active_modules text[] not null default '{}'::text[],
  deploy_mode text not null default 'full' check (deploy_mode in ('full', 'hybrid', 'standalone')),
  email_triage_consent boolean not null default true,
  google_connected boolean not null default false,
  microsoft_connected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.onboarding_drafts enable row level security;

drop policy if exists "own_onboarding_drafts" on public.onboarding_drafts;

create policy "own_onboarding_drafts"
  on public.onboarding_drafts
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_onboarding_drafts_updated_at
  on public.onboarding_drafts(updated_at desc);
