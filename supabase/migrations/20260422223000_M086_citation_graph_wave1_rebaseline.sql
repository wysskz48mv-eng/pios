-- ============================================================
-- M086: Citation Graph Wave-1 Rebaseline
-- Aligns existing M062 foundation with Phase-5 schema targets.
-- Idempotent migration: safe to run on partially provisioned environments.
-- ============================================================

-- ---------- Core tables (augment existing) ----------

create table if not exists pios_papers (
  id uuid primary key default gen_random_uuid(),
  doi text unique,
  arxiv_id text,
  pubmed_id text,
  title text not null,
  abstract text,
  publication_date date,
  publication_year integer,
  venue text,
  venue_type text,
  oa_status text,
  oa_url text,
  pdf_url text,
  citation_count integer not null default 0,
  reference_count integer not null default 0,
  data_source text not null default 'openalex',
  external_id text,
  raw_data jsonb,
  search_vector tsvector,
  first_seen_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table pios_papers add column if not exists arxiv_id text;
alter table pios_papers add column if not exists pubmed_id text;
alter table pios_papers add column if not exists abstract text;
alter table pios_papers add column if not exists publication_date date;
alter table pios_papers add column if not exists venue text;
alter table pios_papers add column if not exists venue_type text;
alter table pios_papers add column if not exists oa_status text;
alter table pios_papers add column if not exists oa_url text;
alter table pios_papers add column if not exists pdf_url text;
alter table pios_papers add column if not exists reference_count integer not null default 0;
alter table pios_papers add column if not exists data_source text;
alter table pios_papers add column if not exists external_id text;
alter table pios_papers add column if not exists raw_data jsonb;
alter table pios_papers add column if not exists search_vector tsvector;
alter table pios_papers add column if not exists last_updated_at timestamptz not null default now();

-- Backfill from legacy columns
update pios_papers set abstract = coalesce(abstract, abstract_excerpt) where abstract is null;
update pios_papers set venue = coalesce(venue, journal) where venue is null;
update pios_papers set data_source = coalesce(nullif(data_source, ''), (sources[1]), 'openalex');

alter table pios_papers alter column data_source set default 'openalex';
update pios_papers set data_source = 'openalex' where data_source is null or btrim(data_source) = '';
alter table pios_papers alter column data_source set not null;

create unique index if not exists idx_pios_papers_doi on pios_papers(doi) where doi is not null;
create index if not exists idx_pios_papers_arxiv on pios_papers(arxiv_id) where arxiv_id is not null;
create index if not exists idx_pios_papers_pubmed on pios_papers(pubmed_id) where pubmed_id is not null;
create index if not exists idx_pios_papers_year_desc on pios_papers(publication_year desc);
create index if not exists idx_pios_papers_citation_count_desc on pios_papers(citation_count desc);
create index if not exists idx_pios_papers_source on pios_papers(data_source);
create index if not exists idx_pios_papers_search on pios_papers using gin(search_vector);


create table if not exists pios_authors (
  id uuid primary key default gen_random_uuid(),
  orcid text unique,
  openalex_id text,
  semantic_scholar_id text,
  full_name text not null,
  display_name text,
  affiliation text,
  affiliation_country text,
  h_index integer,
  paper_count integer not null default 0,
  citation_count integer not null default 0,
  data_source text not null default 'openalex',
  raw_data jsonb,
  created_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now()
);

alter table pios_authors add column if not exists orcid text;
alter table pios_authors add column if not exists openalex_id text;
alter table pios_authors add column if not exists semantic_scholar_id text;
alter table pios_authors add column if not exists full_name text;
alter table pios_authors add column if not exists display_name text;
alter table pios_authors add column if not exists affiliation_country text;
alter table pios_authors add column if not exists paper_count integer not null default 0;
alter table pios_authors add column if not exists citation_count integer not null default 0;
alter table pios_authors add column if not exists data_source text;
alter table pios_authors add column if not exists raw_data jsonb;
alter table pios_authors add column if not exists last_updated_at timestamptz not null default now();

update pios_authors set full_name = coalesce(full_name, name) where full_name is null;
update pios_authors set display_name = coalesce(display_name, name) where display_name is null;
update pios_authors set affiliation_country = coalesce(affiliation_country, country) where affiliation_country is null;
update pios_authors set paper_count = coalesce(paper_count, publication_count, 0);
update pios_authors set citation_count = coalesce(citation_count, total_citations, 0);
update pios_authors set data_source = coalesce(nullif(data_source, ''), 'openalex');

alter table pios_authors alter column full_name set not null;
alter table pios_authors alter column data_source set default 'openalex';
alter table pios_authors alter column data_source set not null;

create unique index if not exists idx_pios_authors_orcid on pios_authors(orcid) where orcid is not null;
create index if not exists idx_pios_authors_name on pios_authors(full_name);
create index if not exists idx_pios_authors_openalex on pios_authors(openalex_id) where openalex_id is not null;


create table if not exists pios_author_papers (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references pios_authors(id) on delete cascade,
  paper_id uuid not null references pios_papers(id) on delete cascade,
  author_position integer,
  is_corresponding boolean not null default false,
  created_at timestamptz not null default now(),
  unique(author_id, paper_id)
);

alter table pios_author_papers add column if not exists id uuid default gen_random_uuid();
alter table pios_author_papers add column if not exists is_corresponding boolean not null default false;

create unique index if not exists idx_pios_author_papers_id on pios_author_papers(id);
create index if not exists idx_author_papers_author on pios_author_papers(author_id);
create index if not exists idx_author_papers_paper on pios_author_papers(paper_id);


create table if not exists pios_citations (
  id uuid primary key default gen_random_uuid(),
  citing_paper_id uuid not null references pios_papers(id) on delete cascade,
  cited_paper_id uuid not null references pios_papers(id) on delete cascade,
  context_snippet text,
  intent text,
  created_at timestamptz not null default now(),
  unique(citing_paper_id, cited_paper_id)
);

alter table pios_citations add column if not exists context_snippet text;
alter table pios_citations add column if not exists intent text;

create index if not exists idx_citations_citing on pios_citations(citing_paper_id);
create index if not exists idx_citations_cited on pios_citations(cited_paper_id);

-- ---------- Intelligence tables ----------

create table if not exists pios_author_collaborations (
  id uuid primary key default gen_random_uuid(),
  author_a_id uuid not null references pios_authors(id) on delete cascade,
  author_b_id uuid not null references pios_authors(id) on delete cascade,
  collaboration_count integer not null default 1,
  first_collaboration_year integer,
  latest_collaboration_year integer,
  shared_papers uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(author_a_id, author_b_id),
  check (author_a_id < author_b_id)
);

create index if not exists idx_collaborations_a on pios_author_collaborations(author_a_id);
create index if not exists idx_collaborations_b on pios_author_collaborations(author_b_id);


create table if not exists pios_research_trends (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  year integer not null,
  paper_count integer not null default 0,
  citation_count integer not null default 0,
  growth_rate numeric(5,2),
  top_venues text[] not null default '{}',
  top_authors uuid[] not null default '{}',
  computed_at timestamptz not null default now(),
  unique(topic, year)
);

alter table pios_research_trends add column if not exists topic text;
alter table pios_research_trends add column if not exists citation_count integer not null default 0;
alter table pios_research_trends add column if not exists growth_rate numeric(5,2);
alter table pios_research_trends add column if not exists top_venues text[] not null default '{}';
alter table pios_research_trends add column if not exists top_authors uuid[] not null default '{}';
alter table pios_research_trends add column if not exists computed_at timestamptz not null default now();

update pios_research_trends set topic = coalesce(topic, field, 'General') where topic is null;

create index if not exists idx_trends_topic on pios_research_trends(topic);
create index if not exists idx_trends_year_desc on pios_research_trends(year desc);


create table if not exists pios_research_landscapes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  user_id uuid not null references auth.users(id),
  name text not null,
  description text,
  topic_keywords text[] not null default '{}',
  topic_cluster jsonb not null default '{}',
  paper_ids uuid[] not null default '{}',
  last_refreshed_at timestamptz,
  refresh_frequency text not null default 'weekly',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_landscapes_user on pios_research_landscapes(user_id);

-- ---------- User tables ----------

create table if not exists pios_paper_enrichment (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  user_id uuid not null references auth.users(id),
  paper_id uuid not null references pios_papers(id) on delete cascade,
  tags text[] not null default '{}',
  notes text,
  highlights jsonb not null default '[]'::jsonb,
  reading_status text,
  added_to_library_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, paper_id)
);

create index if not exists idx_enrichment_user on pios_paper_enrichment(user_id);
create index if not exists idx_enrichment_paper on pios_paper_enrichment(paper_id);
create index if not exists idx_enrichment_status on pios_paper_enrichment(reading_status);


create table if not exists pios_user_searches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  user_id uuid not null references auth.users(id),
  query text not null,
  search_type text not null,
  filters jsonb not null default '{}'::jsonb,
  result_count integer,
  result_paper_ids uuid[] not null default '{}',
  data_source text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_searches_user on pios_user_searches(user_id);
create index if not exists idx_user_searches_created_desc on pios_user_searches(created_at desc);


create table if not exists pios_ingestion_log (
  id uuid primary key default gen_random_uuid(),
  data_source text not null,
  endpoint text not null,
  request_params jsonb not null default '{}'::jsonb,
  status text not null,
  records_fetched integer not null default 0,
  records_inserted integer not null default 0,
  records_updated integer not null default 0,
  error_message text,
  response_time_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_ingestion_source on pios_ingestion_log(data_source);
create index if not exists idx_ingestion_status on pios_ingestion_log(status);
create index if not exists idx_ingestion_created_desc on pios_ingestion_log(created_at desc);

-- ---------- RLS ----------
alter table pios_papers enable row level security;
alter table pios_authors enable row level security;
alter table pios_author_papers enable row level security;
alter table pios_citations enable row level security;
alter table pios_author_collaborations enable row level security;
alter table pios_research_trends enable row level security;
alter table pios_research_landscapes enable row level security;
alter table pios_paper_enrichment enable row level security;
alter table pios_user_searches enable row level security;
alter table pios_ingestion_log enable row level security;

drop policy if exists "pios_papers_select_auth" on pios_papers;
drop policy if exists "pios_authors_select_auth" on pios_authors;
drop policy if exists "pios_author_papers_select_auth" on pios_author_papers;
drop policy if exists "pios_citations_select_auth" on pios_citations;
drop policy if exists "pios_author_collaborations_select_auth" on pios_author_collaborations;
drop policy if exists "pios_research_trends_select_auth" on pios_research_trends;
drop policy if exists "pios_papers_service_write" on pios_papers;
drop policy if exists "pios_authors_service_write" on pios_authors;
drop policy if exists "pios_author_papers_service_write" on pios_author_papers;
drop policy if exists "pios_citations_service_write" on pios_citations;
drop policy if exists "pios_author_collaborations_service_write" on pios_author_collaborations;
drop policy if exists "pios_research_trends_service_write" on pios_research_trends;
drop policy if exists "pios_landscapes_own" on pios_research_landscapes;
drop policy if exists "pios_paper_enrichment_own" on pios_paper_enrichment;
drop policy if exists "pios_user_searches_own" on pios_user_searches;
drop policy if exists "pios_ingestion_log_read_auth" on pios_ingestion_log;
drop policy if exists "pios_ingestion_log_service_write" on pios_ingestion_log;

-- Core graph read for authenticated users
create policy "pios_papers_select_auth"
  on pios_papers for select
  using (auth.uid() is not null);

create policy "pios_authors_select_auth"
  on pios_authors for select
  using (auth.uid() is not null);

create policy "pios_author_papers_select_auth"
  on pios_author_papers for select
  using (auth.uid() is not null);

create policy "pios_citations_select_auth"
  on pios_citations for select
  using (auth.uid() is not null);

create policy "pios_author_collaborations_select_auth"
  on pios_author_collaborations for select
  using (auth.uid() is not null);

create policy "pios_research_trends_select_auth"
  on pios_research_trends for select
  using (auth.uid() is not null);

-- Service role writes for core graph
create policy "pios_papers_service_write"
  on pios_papers for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "pios_authors_service_write"
  on pios_authors for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "pios_author_papers_service_write"
  on pios_author_papers for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "pios_citations_service_write"
  on pios_citations for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "pios_author_collaborations_service_write"
  on pios_author_collaborations for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "pios_research_trends_service_write"
  on pios_research_trends for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- User-owned tables
create policy "pios_landscapes_own"
  on pios_research_landscapes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "pios_paper_enrichment_own"
  on pios_paper_enrichment for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "pios_user_searches_own"
  on pios_user_searches for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "pios_ingestion_log_read_auth"
  on pios_ingestion_log for select
  using (auth.uid() is not null);

create policy "pios_ingestion_log_service_write"
  on pios_ingestion_log for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ---------- Trigger helpers ----------
create or replace function pios_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function pios_set_last_updated_at()
returns trigger language plpgsql as $$
begin
  new.last_updated_at = now();
  return new;
end;
$$;

create or replace function pios_update_search_vector()
returns trigger language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.abstract, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.venue, '')), 'C');
  return new;
end;
$$;

drop trigger if exists trg_pios_papers_search_vector on pios_papers;
create trigger trg_pios_papers_search_vector
before insert or update of title, abstract, venue on pios_papers
for each row execute function pios_update_search_vector();

drop trigger if exists trg_pios_papers_last_updated_at on pios_papers;
create trigger trg_pios_papers_last_updated_at
before update on pios_papers
for each row execute function pios_set_last_updated_at();

drop trigger if exists trg_pios_research_landscapes_updated_at on pios_research_landscapes;
create trigger trg_pios_research_landscapes_updated_at
before update on pios_research_landscapes
for each row execute function pios_set_updated_at();

drop trigger if exists trg_pios_paper_enrichment_updated_at on pios_paper_enrichment;
create trigger trg_pios_paper_enrichment_updated_at
before update on pios_paper_enrichment
for each row execute function pios_set_updated_at();

drop trigger if exists trg_pios_author_collaborations_updated_at on pios_author_collaborations;
create trigger trg_pios_author_collaborations_updated_at
before update on pios_author_collaborations
for each row execute function pios_set_updated_at();

-- Force initial search vector backfill when column exists
update pios_papers
set search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(abstract, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(venue, '')), 'C')
where search_vector is null;
