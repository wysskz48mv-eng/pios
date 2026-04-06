create extension if not exists vector;

create table if not exists persona_configs (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  framework_priority_ids text[] default '{}',
  nemoclaw_register text not null default 'advisor',
  brief_focus_areas text[] default '{}',
  active_by_default boolean default false,
  created_at timestamptz default now()
);

create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  cv_text text,
  cv_confidence float default 0.3,
  stated_role text,
  stated_domain text,
  stated_goals text,
  primary_persona_id uuid references persona_configs(id),
  secondary_persona_id uuid references persona_configs(id),
  calibration_phase smallint default 0,
  profile_confidence float default 0.3,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists domain_contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  domain_name text not null,
  industry_sector text,
  key_decisions text[] default '{}',
  regulatory_context text,
  technical_vocabulary text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  body text,
  status text default 'todo' check (status in ('todo','in_progress','done','blocked')),
  priority text default 'medium' check (priority in ('low','medium','high','critical')),
  due_date date,
  persona text default 'CEO',
  framework_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  agenda text,
  notes text,
  date timestamptz not null,
  duration_mins integer default 60,
  attendees text[] default '{}',
  persona text default 'CEO',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists nemo_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  persona text not null default 'CEO',
  messages jsonb default '[]',
  framework_ids text[] default '{}',
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists daily_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  content text not null,
  generated_at timestamptz default now(),
  persona text default 'CEO',
  unique(user_id, date)
);

create table if not exists behavioural_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  signal_type text not null check (signal_type in ('linguistic','task','override','engagement','probe')),
  signal_value jsonb default '{}',
  inferred_attribute text,
  confidence float default 0.5,
  captured_at timestamptz default now()
);

create table if not exists profile_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  event_type text not null,
  event_data jsonb default '{}',
  profile_confidence_before float,
  profile_confidence_after float,
  created_at timestamptz default now()
);;
