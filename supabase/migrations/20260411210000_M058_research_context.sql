-- ============================================================
-- M058: Research Context (Starter Module)
-- Single per-user record storing thesis/research configuration
-- Used by M059 (literature discovery) and M060 (paper analysis)
-- for personalised relevance scoring and thesis alignment.
-- ============================================================

create table if not exists research_context (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references auth.users(id) on delete cascade,

  -- Thesis / programme
  programme            text not null default 'DBA',          -- DBA|PhD|MRes|MSc|Other
  institution          text,
  department           text,
  start_year           integer,
  expected_end_year    integer,
  supervisor           text,

  -- Research definition
  research_title       text,
  research_topic       text,                                  -- Short label, e.g. "AI forecasting FM GCC"
  research_question    text,                                  -- Primary RQ
  sub_questions        text[] not null default '{}',
  keywords             text[] not null default '{}',          -- Used in literature searches
  excluded_keywords    text[] not null default '{}',          -- Terms to deprioritise

  -- Thesis body context  (fed to Claude for alignment scoring)
  thesis_synopsis      text,                                  -- 1–3 paragraph description
  research_philosophy  text,                                  -- e.g. pragmatism
  methodology_approach text,                                  -- e.g. mixed methods, case study
  geographic_focus     text,                                  -- e.g. GCC, MENA
  industry_focus       text,                                  -- e.g. FM, construction
  theoretical_lens     text,                                  -- e.g. TAM, socio-technical

  -- Citation preferences
  preferred_citation_style text not null default 'apa',      -- apa|chicago|harvard

  -- Status flags
  setup_complete       boolean not null default false,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_research_context_user on research_context(user_id);

alter table research_context enable row level security;
create policy "Users manage own research context"
  on research_context for all
  using (auth.uid() = user_id);

-- Updated-at trigger
create or replace function update_research_context_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_research_context_updated_at
  before update on research_context
  for each row execute function update_research_context_updated_at();
