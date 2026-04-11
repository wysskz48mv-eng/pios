-- ============================================================
-- M060: Paper Analysis & Research Intelligence
-- Tables: paper_analysis, paper_glossary,
--         paper_data_extractions, analysis_batch
-- Depends on: M059 (academic_literature)
-- ============================================================

-- Structured AI analysis per paper
create table if not exists paper_analysis (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  literature_id           uuid not null references academic_literature(id) on delete cascade,
  structured_summary      jsonb not null default '{}',   -- {abstract_summary, findings, methods, implications}
  study_quality_score     numeric(5,2),                  -- 0-100
  quality_breakdown       jsonb not null default '{}',   -- {methodology, generalizability, bias, reproducibility}
  thesis_alignment_score  numeric(5,2),                  -- 0-100
  thesis_alignment_detail text,
  key_findings            text[] not null default '{}',
  methodology_used        text,
  research_gaps           text[] not null default '{}',
  model_used              text,
  tokens_used             integer,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (user_id, literature_id)
);

create index if not exists idx_paper_analysis_user_id    on paper_analysis(user_id);
create index if not exists idx_paper_analysis_literature on paper_analysis(literature_id);

alter table paper_analysis enable row level security;
create policy "Users see own paper analysis"
  on paper_analysis for all
  using (auth.uid() = user_id);

-- Technical glossary extracted from papers
create table if not exists paper_glossary (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  literature_id  uuid not null references academic_literature(id) on delete cascade,
  term           text not null,
  definition     text not null,
  context        text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_paper_glossary_user_id    on paper_glossary(user_id);
create index if not exists idx_paper_glossary_literature on paper_glossary(literature_id);

alter table paper_glossary enable row level security;
create policy "Users see own glossary"
  on paper_glossary for all
  using (auth.uid() = user_id);

-- Notable data extractions (stats, quotes, tables, figures)
create table if not exists paper_data_extractions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  literature_id     uuid not null references academic_literature(id) on delete cascade,
  data_type         text not null,                       -- statistic|quote|table|figure
  content           text not null,
  page_ref          text,
  chapter_context   text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_paper_extractions_user on paper_data_extractions(user_id);

alter table paper_data_extractions enable row level security;
create policy "Users see own extractions"
  on paper_data_extractions for all
  using (auth.uid() = user_id);

-- Multi-paper comparison batches
create table if not exists analysis_batch (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  name                   text not null,
  literature_ids         uuid[] not null default '{}',
  status                 text not null default 'pending',  -- pending|running|complete|failed
  methodology_comparison jsonb,                            -- structured comparison table
  synthesis_essay        text,
  total_papers           integer not null default 0,
  completed_papers       integer not null default 0,
  total_cost_usd         numeric(10,4) not null default 0,
  started_at             timestamptz,
  completed_at           timestamptz,
  created_at             timestamptz not null default now()
);

alter table analysis_batch enable row level security;
create policy "Users see own batches"
  on analysis_batch for all
  using (auth.uid() = user_id);

-- Updated-at trigger for paper_analysis
create or replace function update_paper_analysis_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_paper_analysis_updated_at
  before update on paper_analysis
  for each row execute function update_paper_analysis_updated_at();
