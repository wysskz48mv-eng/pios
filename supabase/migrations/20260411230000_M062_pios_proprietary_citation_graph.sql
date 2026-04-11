-- ============================================================
-- M062: PIOS Proprietary Citation Graph Foundation
-- Legal scope: metadata only (no full-text storage)
-- ============================================================

create table if not exists pios_papers (
  id                  uuid primary key default gen_random_uuid(),
  doi                 text unique,
  title               text not null,
  title_normalized    text not null unique,
  authors             text[] not null default '{}',
  publication_year    int,
  journal             text,
  abstract_excerpt    text, -- metadata excerpt only

  field_classifications text[] not null default '{}',
  keywords              text[] not null default '{}',
  open_access           boolean not null default false,
  free_pdf_url          text,

  citation_count      int not null default 0,
  influence_score     numeric(7,3) not null default 0,
  h_index_contribution int not null default 0,

  sources             text[] not null default '{}',
  first_seen_at       timestamptz not null default now(),
  last_updated        timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create index if not exists idx_pios_papers_year on pios_papers(publication_year);
create index if not exists idx_pios_papers_journal on pios_papers(journal);
create index if not exists idx_pios_papers_citations on pios_papers(citation_count desc);
create index if not exists idx_pios_papers_sources on pios_papers using gin (sources);
create index if not exists idx_pios_papers_keywords on pios_papers using gin (keywords);

create table if not exists pios_citations (
  id               uuid primary key default gen_random_uuid(),
  citing_paper_id  uuid references pios_papers(id) on delete cascade,
  cited_paper_id   uuid references pios_papers(id) on delete cascade,
  citing_doi       text,
  cited_doi        text,
  citation_type    text,
  year             int,
  created_at       timestamptz not null default now(),

  unique(citing_paper_id, cited_paper_id),
  unique(citing_doi, cited_doi)
);

create index if not exists idx_pios_citations_citing_doi on pios_citations(citing_doi);
create index if not exists idx_pios_citations_cited_doi on pios_citations(cited_doi);

create table if not exists pios_authors (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  normalized_name    text not null unique,
  affiliation        text,
  country            text,
  publication_count  int not null default 0,
  h_index            int not null default 0,
  total_citations    int not null default 0,
  last_updated       timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

create index if not exists idx_pios_authors_name on pios_authors(name);
create index if not exists idx_pios_authors_total_citations on pios_authors(total_citations desc);

create table if not exists pios_author_papers (
  author_id         uuid not null references pios_authors(id) on delete cascade,
  paper_id          uuid not null references pios_papers(id) on delete cascade,
  author_position   int,
  created_at        timestamptz not null default now(),
  primary key (author_id, paper_id)
);

create index if not exists idx_pios_author_papers_paper on pios_author_papers(paper_id);

create table if not exists pios_research_trends (
  id                uuid primary key default gen_random_uuid(),
  field             text not null,
  keyword           text not null,
  year              int not null,
  paper_count       int not null default 0,
  citation_growth   numeric(7,3) not null default 0,
  emerging          boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(field, keyword, year)
);

create index if not exists idx_pios_trends_field_year on pios_research_trends(field, year);
create index if not exists idx_pios_trends_emerging on pios_research_trends(emerging);

create table if not exists pios_ingestion_events (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  source             text not null default 'academic_literature',
  papers_considered  int not null default 0,
  papers_upserted    int not null default 0,
  authors_upserted   int not null default 0,
  links_upserted     int not null default 0,
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  status             text not null default 'success',
  notes              text
);

create index if not exists idx_pios_ingestion_user on pios_ingestion_events(user_id);
create index if not exists idx_pios_ingestion_started on pios_ingestion_events(started_at desc);

-- RLS
alter table pios_papers enable row level security;
alter table pios_citations enable row level security;
alter table pios_authors enable row level security;
alter table pios_author_papers enable row level security;
alter table pios_research_trends enable row level security;
alter table pios_ingestion_events enable row level security;

create policy "Authenticated users can read pios papers"
  on pios_papers for select using (auth.uid() is not null);
create policy "Authenticated users can upsert pios papers"
  on pios_papers for all using (auth.uid() is not null);

create policy "Authenticated users can read pios citations"
  on pios_citations for select using (auth.uid() is not null);
create policy "Authenticated users can upsert pios citations"
  on pios_citations for all using (auth.uid() is not null);

create policy "Authenticated users can read pios authors"
  on pios_authors for select using (auth.uid() is not null);
create policy "Authenticated users can upsert pios authors"
  on pios_authors for all using (auth.uid() is not null);

create policy "Authenticated users can read author-paper links"
  on pios_author_papers for select using (auth.uid() is not null);
create policy "Authenticated users can upsert author-paper links"
  on pios_author_papers for all using (auth.uid() is not null);

create policy "Authenticated users can read trends"
  on pios_research_trends for select using (auth.uid() is not null);
create policy "Authenticated users can upsert trends"
  on pios_research_trends for all using (auth.uid() is not null);

create policy "Users can read own ingestion events"
  on pios_ingestion_events for select using (auth.uid() = user_id);
create policy "Users can insert own ingestion events"
  on pios_ingestion_events for insert with check (auth.uid() = user_id);
create policy "Users can update own ingestion events"
  on pios_ingestion_events for update using (auth.uid() = user_id);

-- Updated-at triggers
create or replace function pios_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_pios_research_trends_updated_at on pios_research_trends;
create trigger trg_pios_research_trends_updated_at
before update on pios_research_trends
for each row execute function pios_touch_updated_at();

create or replace function pios_touch_last_updated()
returns trigger language plpgsql as $$
begin
  new.last_updated = now();
  return new;
end;
$$;

drop trigger if exists trg_pios_papers_last_updated on pios_papers;
create trigger trg_pios_papers_last_updated
before update on pios_papers
for each row execute function pios_touch_last_updated();

drop trigger if exists trg_pios_authors_last_updated on pios_authors;
create trigger trg_pios_authors_last_updated
before update on pios_authors
for each row execute function pios_touch_last_updated();
