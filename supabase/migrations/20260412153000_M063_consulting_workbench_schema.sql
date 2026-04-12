-- M063: Consulting Workbench schema foundation and repair
-- Creates/repairs tables expected by /api/workbench routes.

create table if not exists public.consulting_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_name text not null,
  client_name text,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'archived')),
  current_step integer not null default 1 check (current_step between 1 and 7),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.consulting_projects add column if not exists user_id uuid;
alter table public.consulting_projects add column if not exists project_name text;
alter table public.consulting_projects add column if not exists client_name text;
alter table public.consulting_projects add column if not exists status text;
alter table public.consulting_projects add column if not exists current_step integer;
alter table public.consulting_projects add column if not exists archived_at timestamptz;
alter table public.consulting_projects add column if not exists created_at timestamptz default now();
alter table public.consulting_projects add column if not exists updated_at timestamptz default now();

update public.consulting_projects set status = 'in_progress' where status is null;
update public.consulting_projects set current_step = 1 where current_step is null;

create table if not exists public.analysis_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.consulting_projects(id) on delete cascade,
  step_number integer not null check (step_number between 1 and 7),
  problem_statement text,
  smart_question text,
  issue_tree jsonb,
  mece_validation jsonb,
  prioritization_matrix jsonb,
  work_sequence text[],
  raci_matrix jsonb,
  project_timeline jsonb,
  research_guides jsonb,
  raw_data jsonb,
  data_quality_score numeric,
  synthesized_findings jsonb,
  pyramid_structure jsonb,
  confidence_level numeric,
  options jsonb,
  recommendation text,
  implementation_roadmap jsonb,
  status text not null default 'in_progress' check (status in ('not_started', 'in_progress', 'completed')),
  gate_status text check (gate_status in ('pending', 'passed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.analysis_steps add column if not exists project_id uuid;
alter table public.analysis_steps add column if not exists step_number integer;
alter table public.analysis_steps add column if not exists problem_statement text;
alter table public.analysis_steps add column if not exists smart_question text;
alter table public.analysis_steps add column if not exists issue_tree jsonb;
alter table public.analysis_steps add column if not exists mece_validation jsonb;
alter table public.analysis_steps add column if not exists prioritization_matrix jsonb;
alter table public.analysis_steps add column if not exists work_sequence text[];
alter table public.analysis_steps add column if not exists raci_matrix jsonb;
alter table public.analysis_steps add column if not exists project_timeline jsonb;
alter table public.analysis_steps add column if not exists research_guides jsonb;
alter table public.analysis_steps add column if not exists raw_data jsonb;
alter table public.analysis_steps add column if not exists data_quality_score numeric;
alter table public.analysis_steps add column if not exists synthesized_findings jsonb;
alter table public.analysis_steps add column if not exists pyramid_structure jsonb;
alter table public.analysis_steps add column if not exists confidence_level numeric;
alter table public.analysis_steps add column if not exists options jsonb;
alter table public.analysis_steps add column if not exists recommendation text;
alter table public.analysis_steps add column if not exists implementation_roadmap jsonb;
alter table public.analysis_steps add column if not exists status text;
alter table public.analysis_steps add column if not exists gate_status text;
alter table public.analysis_steps add column if not exists created_at timestamptz default now();
alter table public.analysis_steps add column if not exists updated_at timestamptz default now();

update public.analysis_steps set status = 'in_progress' where status is null;

create table if not exists public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.consulting_projects(id) on delete cascade,
  step_number integer,
  interaction_type text,
  user_input text,
  ai_response text,
  model_used text,
  tokens_used integer,
  cost_cents integer,
  created_at timestamptz not null default now()
);

alter table public.ai_interactions add column if not exists project_id uuid;
alter table public.ai_interactions add column if not exists step_number integer;
alter table public.ai_interactions add column if not exists interaction_type text;
alter table public.ai_interactions add column if not exists user_input text;
alter table public.ai_interactions add column if not exists ai_response text;
alter table public.ai_interactions add column if not exists model_used text;
alter table public.ai_interactions add column if not exists tokens_used integer;
alter table public.ai_interactions add column if not exists cost_cents integer;
alter table public.ai_interactions add column if not exists created_at timestamptz default now();

create table if not exists public.project_artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.consulting_projects(id) on delete cascade,
  artifact_type text not null,
  artifact_name text,
  storage_path text,
  generated_from_step integer,
  created_at timestamptz not null default now()
);

alter table public.project_artifacts add column if not exists project_id uuid;
alter table public.project_artifacts add column if not exists artifact_type text;
alter table public.project_artifacts add column if not exists artifact_name text;
alter table public.project_artifacts add column if not exists storage_path text;
alter table public.project_artifacts add column if not exists generated_from_step integer;
alter table public.project_artifacts add column if not exists created_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'analysis_steps_project_step_unique'
      and conrelid = 'public.analysis_steps'::regclass
  ) then
    alter table public.analysis_steps
      add constraint analysis_steps_project_step_unique unique (project_id, step_number);
  end if;
end $$;

create index if not exists idx_consulting_projects_user_id on public.consulting_projects(user_id);
create index if not exists idx_consulting_projects_updated_at on public.consulting_projects(updated_at desc);
create index if not exists idx_analysis_steps_project_id on public.analysis_steps(project_id);
create index if not exists idx_ai_interactions_project_id on public.ai_interactions(project_id);
create index if not exists idx_project_artifacts_project_id on public.project_artifacts(project_id);

create or replace function public.workbench_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_workbench_projects_updated_at on public.consulting_projects;
create trigger trg_workbench_projects_updated_at
before update on public.consulting_projects
for each row
execute function public.workbench_set_updated_at();

drop trigger if exists trg_workbench_steps_updated_at on public.analysis_steps;
create trigger trg_workbench_steps_updated_at
before update on public.analysis_steps
for each row
execute function public.workbench_set_updated_at();

alter table public.consulting_projects enable row level security;
alter table public.analysis_steps enable row level security;
alter table public.ai_interactions enable row level security;
alter table public.project_artifacts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'consulting_projects' and policyname = 'consulting_projects_owner_all'
  ) then
    create policy consulting_projects_owner_all on public.consulting_projects
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'analysis_steps' and policyname = 'analysis_steps_owner_via_project'
  ) then
    create policy analysis_steps_owner_via_project on public.analysis_steps
      for all
      using (
        exists (
          select 1
          from public.consulting_projects p
          where p.id = analysis_steps.project_id
            and p.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.consulting_projects p
          where p.id = analysis_steps.project_id
            and p.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_interactions' and policyname = 'ai_interactions_owner_via_project'
  ) then
    create policy ai_interactions_owner_via_project on public.ai_interactions
      for all
      using (
        exists (
          select 1
          from public.consulting_projects p
          where p.id = ai_interactions.project_id
            and p.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.consulting_projects p
          where p.id = ai_interactions.project_id
            and p.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_artifacts' and policyname = 'project_artifacts_owner_via_project'
  ) then
    create policy project_artifacts_owner_via_project on public.project_artifacts
      for all
      using (
        exists (
          select 1
          from public.consulting_projects p
          where p.id = project_artifacts.project_id
            and p.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.consulting_projects p
          where p.id = project_artifacts.project_id
            and p.user_id = auth.uid()
        )
      );
  end if;
end $$;
