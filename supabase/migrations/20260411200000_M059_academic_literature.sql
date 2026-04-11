-- ============================================================
-- M059: Academic Literature Discovery
-- Tables: academic_literature, literature_search_history,
--         literature_citations
-- ============================================================

-- Main literature store
create table if not exists academic_literature (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  title                text not null,
  authors              jsonb not null default '[]',       -- [{name, affiliations}]
  year                 integer,
  abstract             text,
  doi                  text,
  arxiv_id             text,
  semantic_scholar_id  text,
  openalex_id          text,
  journal              text,
  venue                text,
  source_api           text not null default 'manual',   -- semantic_scholar|openalex|arxiv|crossref|manual
  relevance_score      numeric(5,3),                     -- Claude-scored 0-1
  pdf_url              text,
  unpaywall_oa_url     text,
  citation_count       integer not null default 0,
  is_saved             boolean not null default false,
  linked_chapter_id    uuid references thesis_chapters(id) on delete set null,
  tags                 text[] not null default '{}',
  notes                text,
  raw_metadata         jsonb not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_academic_literature_user_id    on academic_literature(user_id);
create index if not exists idx_academic_literature_saved      on academic_literature(user_id, is_saved) where is_saved = true;
create index if not exists idx_academic_literature_chapter    on academic_literature(linked_chapter_id);
create index if not exists idx_academic_literature_doi        on academic_literature(doi) where doi is not null;

alter table academic_literature enable row level security;
create policy "Users see own literature"
  on academic_literature for all
  using (auth.uid() = user_id);

-- Search history for cost tracking and UX
create table if not exists literature_search_history (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  query            text not null,
  filters          jsonb not null default '{}',
  result_count     integer not null default 0,
  sources_searched text[] not null default '{}',
  searched_at      timestamptz not null default now()
);

create index if not exists idx_lit_search_user on literature_search_history(user_id);

alter table literature_search_history enable row level security;
create policy "Users see own search history"
  on literature_search_history for all
  using (auth.uid() = user_id);

-- Citation store (formatted bibliography entries)
create table if not exists literature_citations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  literature_id   uuid not null references academic_literature(id) on delete cascade,
  citation_style  text not null default 'apa',           -- apa|chicago|harvard
  citation_text   text not null,
  chapter_id      uuid references thesis_chapters(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_lit_citations_user        on literature_citations(user_id);
create index if not exists idx_lit_citations_literature  on literature_citations(literature_id);

alter table literature_citations enable row level security;
create policy "Users see own citations"
  on literature_citations for all
  using (auth.uid() = user_id);

-- Updated-at trigger
create or replace function update_academic_literature_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_academic_literature_updated_at
  before update on academic_literature
  for each row execute function update_academic_literature_updated_at();
