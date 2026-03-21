-- ============================================================
-- PIOS Migration 004 — Research Infrastructure
-- Journal watchlist, CFP tracker, FM news feeds, DB searches
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Journal watchlist ─────────────────────────────────────────────────────
-- Journals Douglas is targeting for publication
create table if not exists public.journal_watchlist (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references auth.users(id) on delete cascade,
  journal_name      text not null,
  issn              text,
  publisher         text,
  impact_factor     numeric(6,3),
  quartile          text check (quartile in ('Q1','Q2','Q3','Q4','Unranked')),
  subject_area      text,
  scope_notes       text,                    -- what topics they cover
  submission_url    text,
  guidelines_url    text,
  template_url      text,
  review_process    text default 'double_blind' check (review_process in ('single_blind','double_blind','open','post_publication')),
  typical_turnaround_days integer,
  word_limit        integer,
  open_access       boolean default false,
  apc_usd           integer,                 -- article processing charge
  is_scopus_indexed boolean default true,
  priority          text default 'medium' check (priority in ('high','medium','low','watch')),
  status            text default 'researching' check (status in ('researching','drafting','submitted','under_review','accepted','rejected','published')),
  submission_date   date,
  decision_date     date,
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ── 2. Calls for papers tracker ──────────────────────────────────────────────
create table if not exists public.paper_calls (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references auth.users(id) on delete cascade,
  title            text not null,            -- e.g. "Special Issue: AI in FM"
  journal_name     text,
  conference_name  text,
  call_type        text default 'special_issue' check (call_type in ('special_issue','regular_issue','conference','workshop','book_chapter')),
  topic_summary    text,
  deadline         date,
  submission_url   text,
  relevance_score  integer check (relevance_score between 1 and 5),
  status           text default 'new' check (status in ('new','considering','planning','dismissed')),
  source_url       text,                     -- where the CFP was found
  notes            text,
  created_at       timestamptz default now()
);

-- ── 3. FM industry news items ────────────────────────────────────────────────
-- Cached news articles from live FM domain searches
create table if not exists public.fm_news_items (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete cascade,
  headline     text not null,
  summary      text,
  source       text,
  source_url   text,
  published_at timestamptz,
  category     text default 'general' check (category in (
    'general','technology','regulation','market','sustainability',
    'giga_projects','middle_east','standards','workforce','ai_fm'
  )),
  relevance    integer check (relevance between 1 and 5),
  saved        boolean default false,
  read         boolean default false,
  fetched_at   timestamptz default now()
);

-- ── 4. Academic database searches ────────────────────────────────────────────
-- Log of searches run across Scopus / Web of Science / Google Scholar
create table if not exists public.database_searches (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade,
  query         text not null,
  database_name text default 'scopus' check (database_name in (
    'scopus','web_of_science','google_scholar','ieee','pubmed',
    'jstor','emerald','taylor_francis','sage','other'
  )),
  filters       jsonb default '{}'::jsonb,   -- year range, subject area, etc.
  result_count  integer,
  results       jsonb default '[]'::jsonb,   -- array of {title, authors, year, doi, abstract}
  notes         text,
  created_at    timestamptz default now()
);

-- ── 5. Row-level security ────────────────────────────────────────────────────
alter table public.journal_watchlist  enable row level security;
alter table public.paper_calls        enable row level security;
alter table public.fm_news_items      enable row level security;
alter table public.database_searches  enable row level security;

create policy "own_journals"   on public.journal_watchlist  for all using (auth.uid() = user_id);
create policy "own_cfps"       on public.paper_calls        for all using (auth.uid() = user_id);
create policy "own_fm_news"    on public.fm_news_items      for all using (auth.uid() = user_id);
create policy "own_db_searches" on public.database_searches  for all using (auth.uid() = user_id);

-- ── 6. Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_journal_watchlist_user   on public.journal_watchlist(user_id);
create index if not exists idx_paper_calls_user         on public.paper_calls(user_id, deadline);
create index if not exists idx_fm_news_user             on public.fm_news_items(user_id, fetched_at desc);
create index if not exists idx_db_searches_user         on public.database_searches(user_id, created_at desc);

-- ── 7. Seed: Douglas's target journals ───────────────────────────────────────
-- Run after auth to get user_id, or update user_id manually
-- These are representative FM/AI/management journals relevant to DBA research

do $$
declare v_user_id uuid;
begin
  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then return; end if;

  insert into public.journal_watchlist (user_id, journal_name, publisher, impact_factor, quartile, subject_area, scope_notes, submission_url, guidelines_url, review_process, word_limit, open_access, is_scopus_indexed, priority, status) values

  (v_user_id, 'Facilities', 'Emerald', 1.8, 'Q2', 'Facilities Management', 'FM strategy, workplace management, built environment. Strong alignment with GCC FM research.', 'https://www.emerald.com/insight/publication/issn/0263-2772', 'https://www.emerald.com/insight/publication/issn/0263-2772/author-guidelines', 'double_blind', 8000, false, true, 'high', 'researching'),

  (v_user_id, 'Journal of Facilities Management', 'Emerald', 1.6, 'Q2', 'Facilities Management', 'Strategic FM, outsourcing, sustainability, smart buildings. Key outlet for FM academic work.', 'https://www.emerald.com/insight/publication/issn/1472-5967', 'https://www.emerald.com/insight/publication/issn/1472-5967/author-guidelines', 'double_blind', 8000, false, true, 'high', 'researching'),

  (v_user_id, 'Construction Management and Economics', 'Taylor & Francis', 3.2, 'Q1', 'Built Environment / FM', 'Construction, FM lifecycle, asset management. High impact, competitive.', 'https://www.tandfonline.com/journals/rcme20', 'https://www.tandfonline.com/action/authorSubmission?journalCode=rcme20', 'double_blind', 9000, false, true, 'medium', 'researching'),

  (v_user_id, 'International Journal of Strategic Property Management', 'Taylor & Francis', 2.1, 'Q2', 'Property / FM / AI', 'Property and FM strategy, asset management, smart real estate. Open access option.', 'https://www.tandfonline.com/journals/tspm20', 'https://www.tandfonline.com/action/authorSubmission?journalCode=tspm20', 'double_blind', 8000, false, true, 'high', 'researching'),

  (v_user_id, 'Technological Forecasting and Social Change', 'Elsevier', 12.9, 'Q1', 'AI / Technology / Management', 'AI adoption, digital transformation, foresight — strong STS theory alignment for DBA research.', 'https://www.sciencedirect.com/journal/technological-forecasting-and-social-change', 'https://www.sciencedirect.com/journal/technological-forecasting-and-social-change/publish/guide-for-authors', 'double_blind', 12000, false, true, 'medium', 'researching'),

  (v_user_id, 'Journal of Building Engineering', 'Elsevier', 6.4, 'Q1', 'Built Environment / AI', 'Smart buildings, IoT, AI in construction and FM. High impact, Scopus indexed.', 'https://www.sciencedirect.com/journal/journal-of-building-engineering', 'https://www.sciencedirect.com/journal/journal-of-building-engineering/publish/guide-for-authors', 'double_blind', 10000, false, true, 'medium', 'researching'),

  (v_user_id, 'Automation in Construction', 'Elsevier', 9.8, 'Q1', 'AI / Construction / FM', 'AI, machine learning, automation in built environment. Premium outlet for AI-FM research.', 'https://www.sciencedirect.com/journal/automation-in-construction', 'https://www.sciencedirect.com/journal/automation-in-construction/publish/guide-for-authors', 'double_blind', 10000, false, true, 'watch', 'researching');

end $$;

-- ── 8. Verify ────────────────────────────────────────────────────────────────
select
  (select count(*) from public.journal_watchlist)  as journals_seeded,
  (select count(*) from public.paper_calls)         as cfps,
  (select count(*) from public.fm_news_items)       as news_items,
  (select count(*) from public.database_searches)   as searches;
