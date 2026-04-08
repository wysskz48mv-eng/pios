create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete cascade,
  full_name text,
  display_name text,
  avatar_url text,
  role text,
  persona_type text not null default 'executive',
  command_centre_theme text not null default 'onyx' check (command_centre_theme in ('onyx', 'meridian', 'signal')),
  onboarded boolean not null default false,
  plan text not null default 'free',
  job_title text,
  organisation text,
  programme_name text,
  google_email text,
  google_access_token text,
  tenant_id uuid,
  deployment_mode text not null default 'full' check (deployment_mode in ('full', 'hybrid', 'standalone')),
  active_modules text[] not null default '{}'::text[],
  it_policy_acknowledged boolean not null default false,
  cv_filename text,
  cv_uploaded_at timestamptz,
  cv_processing_status text not null default 'none' check (cv_processing_status in ('none', 'processing', 'complete', 'failed')),
  cv_storage_path text,
  billing_status text not null default 'none',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles
  add column if not exists user_id uuid unique references auth.users(id) on delete cascade,
  add column if not exists full_name text,
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists role text,
  add column if not exists persona_type text not null default 'executive',
  add column if not exists command_centre_theme text not null default 'onyx',
  add column if not exists onboarded boolean not null default false,
  add column if not exists plan text not null default 'free',
  add column if not exists job_title text,
  add column if not exists organisation text,
  add column if not exists programme_name text,
  add column if not exists google_email text,
  add column if not exists google_access_token text,
  add column if not exists tenant_id uuid,
  add column if not exists deployment_mode text not null default 'full',
  add column if not exists active_modules text[] not null default '{}'::text[],
  add column if not exists it_policy_acknowledged boolean not null default false,
  add column if not exists cv_filename text,
  add column if not exists cv_uploaded_at timestamptz,
  add column if not exists cv_processing_status text not null default 'none',
  add column if not exists cv_storage_path text,
  add column if not exists billing_status text not null default 'none',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists current_period_end timestamptz,
  add column if not exists trial_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.user_profiles
set user_id = id
where user_id is null;

create unique index if not exists idx_user_profiles_user_id on public.user_profiles(user_id);
create index if not exists idx_user_profiles_tenant_id on public.user_profiles(tenant_id);
create index if not exists idx_user_profiles_plan on public.user_profiles(plan);
create index if not exists idx_user_profiles_stripe_customer_id on public.user_profiles(stripe_customer_id);

alter table public.user_profiles enable row level security;

drop policy if exists user_profiles_own on public.user_profiles;
create policy user_profiles_own
  on public.user_profiles
  for all
  to authenticated
  using (id = auth.uid() or user_id = auth.uid())
  with check (id = auth.uid() or user_id = auth.uid());

create or replace function public.current_profile_tenant_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select tenant_id
  from public.user_profiles
  where id = auth.uid() or user_id = auth.uid()
  limit 1
$$;

create or replace function public.bootstrap_user_profile(
  p_user_id uuid,
  p_email text default null,
  p_raw_user_meta_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_full_name text := coalesce(
    nullif(trim(p_raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(p_raw_user_meta_data ->> 'name'), ''),
    nullif(trim(split_part(coalesce(p_email, ''), '@', 1)), ''),
    'User'
  );
  v_display_name text := coalesce(
    nullif(trim(p_raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(p_raw_user_meta_data ->> 'name'), ''),
    v_full_name
  );
  v_google_email text := coalesce(
    nullif(trim(p_raw_user_meta_data ->> 'email'), ''),
    nullif(trim(p_email), '')
  );
begin
  insert into public.user_profiles (
    id,
    user_id,
    full_name,
    display_name,
    google_email,
    persona_type,
    command_centre_theme,
    onboarded,
    plan,
    deployment_mode,
    active_modules,
    cv_processing_status,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    p_user_id,
    v_full_name,
    v_display_name,
    v_google_email,
    'executive',
    'onyx',
    false,
    'free',
    'full',
    '{}'::text[],
    'none',
    now(),
    now()
  )
  on conflict (id) do update
  set user_id = excluded.user_id,
      full_name = coalesce(public.user_profiles.full_name, excluded.full_name),
      display_name = coalesce(public.user_profiles.display_name, excluded.display_name),
      google_email = coalesce(public.user_profiles.google_email, excluded.google_email),
      updated_at = now();
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  perform public.bootstrap_user_profile(new.id, new.email, coalesce(new.raw_user_meta_data, '{}'::jsonb));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

do $$
declare
  auth_user record;
begin
  for auth_user in
    select id, email, raw_user_meta_data
    from auth.users
  loop
    perform public.bootstrap_user_profile(
      auth_user.id,
      auth_user.email,
      coalesce(auth_user.raw_user_meta_data, '{}'::jsonb)
    );
  end loop;
end;
$$;

create table if not exists public.nemoclaw_calibration (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  education_level text,
  education_detail text,
  career_years integer,
  seniority_level text,
  primary_industry text,
  industries text[] default '{}'::text[],
  skills text[] default '{}'::text[],
  qualifications text[] default '{}'::text[],
  employers text[] default '{}'::text[],
  key_achievements text[] default '{}'::text[],
  communication_register text default 'professional',
  coaching_intensity text default 'balanced',
  recommended_frameworks text[] default '{}'::text[],
  growth_areas text[] default '{}'::text[],
  strengths text[] default '{}'::text[],
  work_life_signals text,
  decision_style text,
  calibration_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.nemoclaw_calibration enable row level security;

drop policy if exists nemoclaw_calibration_own on public.nemoclaw_calibration;
create policy nemoclaw_calibration_own
  on public.nemoclaw_calibration
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_nemoclaw_calibration_user_id on public.nemoclaw_calibration(user_id);

create table if not exists public.exec_intelligence_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ai_calls_used integer not null default 0,
  ai_calls_limit integer not null default 100,
  reset_date timestamptz default (now() + interval '30 days'),
  brief_enabled boolean not null default true,
  brief_time text not null default '07:00',
  timezone text not null default 'Europe/London',
  persona text not null default 'executive',
  updated_at timestamptz not null default now()
);

alter table public.exec_intelligence_config enable row level security;

drop policy if exists exec_intelligence_config_own on public.exec_intelligence_config;
create policy exec_intelligence_config_own
  on public.exec_intelligence_config
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text,
  category text default 'insight',
  source text,
  tags text[] default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.knowledge_entries enable row level security;

drop policy if exists knowledge_entries_own on public.knowledge_entries;
create policy knowledge_entries_own
  on public.knowledge_entries
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_knowledge_entries_user_id on public.knowledge_entries(user_id);