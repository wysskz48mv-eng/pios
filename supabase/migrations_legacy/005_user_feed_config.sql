-- ============================================================
-- PIOS Migration 005 — User Feed Configuration
-- Per-user configurable news feed preferences for Command Centre
-- ============================================================

-- ── 1. Feed topics table ─────────────────────────────────────────────────────
-- Each row is one topic/feed channel the user has configured.
-- Users can have multiple feeds displayed in their Command Centre.
create table if not exists public.user_feed_topics (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,

  -- Display
  label         text not null,              -- User-facing name, e.g. "GCC FM Market"
  description   text,                       -- What this feed covers
  emoji         text default '📰',          -- Icon for the feed card

  -- Feed configuration
  topic         text not null,              -- Core topic prompt, e.g. "facilities management GCC Saudi Arabia"
  keywords      text[] default '{}',        -- Additional keywords to include
  sources       text[] default '{}',        -- Preferred sources (e.g. FM World, MEED, RICS)
  exclude_terms text[] default '{}',        -- Terms to exclude from results

  -- Layout & behaviour
  sort_order    integer default 0,
  is_active     boolean default true,
  layout        text default 'cards' check (layout in ('cards','list','headlines')),
  refresh_freq  text default 'daily' check (refresh_freq in ('realtime','hourly','daily','weekly')),
  max_items     integer default 8 check (max_items between 3 and 20),

  -- Feed category (drives colour coding and grouping)
  category      text default 'industry' check (category in (
    'industry',      -- FM, real estate, construction market
    'academic',      -- Research journals, calls for papers, academic news
    'regulatory',    -- Standards, legislation, government policy
    'technology',    -- AI, PropTech, smart buildings
    'business',      -- Company news, M&A, financial
    'personal'       -- Custom user-defined
  )),

  -- Cache
  last_fetched  timestamptz,
  cached_items  jsonb default '[]'::jsonb,  -- Last fetched items stored here

  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── 2. Feed settings (global per user) ───────────────────────────────────────
create table if not exists public.user_feed_settings (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  command_layout      text default 'grid' check (command_layout in ('grid','list','focused')),
  brief_include_feeds boolean default true,     -- Include top feed items in morning brief
  brief_feed_count    integer default 3,        -- How many feed items to inject into brief
  auto_refresh        boolean default true,     -- Auto-refresh feeds on Command Centre load
  show_relevance      boolean default true,     -- Show AI relevance score on items
  default_category    text default 'industry',
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── 3. RLS ───────────────────────────────────────────────────────────────────
alter table public.user_feed_topics   enable row level security;
alter table public.user_feed_settings enable row level security;

create policy "own_feed_topics"   on public.user_feed_topics   for all using (auth.uid() = user_id);
create policy "own_feed_settings" on public.user_feed_settings for all using (auth.uid() = user_id);

-- ── 4. Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_feed_topics_user   on public.user_feed_topics(user_id, sort_order);
create index if not exists idx_feed_settings_user on public.user_feed_settings(user_id);

-- ── 5. Seed Douglas's default feeds ─────────────────────────────────────────
do $$
declare v_user_id uuid;
begin
  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then return; end if;

  -- Insert default feed settings
  insert into public.user_feed_settings (user_id, command_layout, brief_include_feeds, brief_feed_count)
  values (v_user_id, 'grid', true, 3)
  on conflict (user_id) do nothing;

  -- Insert 6 default feed topics
  insert into public.user_feed_topics
    (user_id, label, description, emoji, topic, keywords, sources, sort_order, category, max_items)
  values

  (v_user_id,
   'GCC FM Market',
   'Facilities management market news across Saudi Arabia, UAE, Qatar and wider GCC',
   '🏗️',
   'facilities management GCC Saudi Arabia UAE Qatar market news',
   ARRAY['NEOM','Qiddiya','giga-project','service charge','FM outsourcing','Vision 2030'],
   ARRAY['MEED','Arab News','Construction Week','FM World Middle East','The National'],
   0, 'industry', 8),

  (v_user_id,
   'AI & PropTech',
   'Artificial intelligence, smart buildings, digital twins and property technology',
   '🤖',
   'artificial intelligence facilities management smart buildings digital twin PropTech',
   ARRAY['predictive maintenance','IoT FM','BIM','CAFM','AI adoption','machine learning FM'],
   ARRAY['FM World','RICS','Facilities Management Journal','Building Design','Construction Dive'],
   1, 'technology', 8),

  (v_user_id,
   'FM Standards & Regulation',
   'ISO 55001, RICS standards, BIFM publications, regulatory updates',
   '📋',
   'ISO 55001 asset management standard RICS facilities management regulation BIFM',
   ARRAY['ISO 55001','ISO 41001','EN 15221','RICS FM code','BIFM guidance','CIBSE'],
   ARRAY['RICS','BSI','ISO','BIFM','IFMA'],
   2, 'regulatory', 6),

  (v_user_id,
   'Academic FM Research',
   'New publications, journal articles and research on FM, AI adoption and built environment',
   '🎓',
   'academic research facilities management AI adoption built environment journal articles',
   ARRAY['Facilities journal','STS theory','sensemaking','AI FM research','DBA research','GCC built environment'],
   ARRAY['Emerald Publishing','Taylor & Francis','Elsevier','IFMA Foundation','EuroFM'],
   3, 'academic', 6),

  (v_user_id,
   'SustainEdge Competitive Intel',
   'Service charge management software, proptech competitors, FM SaaS market',
   '📊',
   'service charge management software SaaS facilities management platform proptech',
   ARRAY['Yardi','MRI Software','Planon','Facilio','CAFM Explorer','service charge software'],
   ARRAY['Property Week','EG','CoStar','PropTech Insider','Real Estate Tech News'],
   4, 'business', 6),

  (v_user_id,
   'FM Sustainability & ESG',
   'Net zero buildings, ESG in FM, green certification, carbon reporting',
   '🌱',
   'sustainability ESG facilities management net zero buildings carbon reporting green',
   ARRAY['net zero','BREEAM','LEED','carbon footprint FM','ESG reporting built environment','green FM'],
   ARRAY['BREEAM','Green Building Council','RICS','Sustainability Built Environment','CIBSE'],
   5, 'industry', 6);

end $$;

-- ── 6. Verify ────────────────────────────────────────────────────────────────
select
  (select count(*) from public.user_feed_topics)   as feed_topics_seeded,
  (select count(*) from public.user_feed_settings) as feed_settings_seeded;
