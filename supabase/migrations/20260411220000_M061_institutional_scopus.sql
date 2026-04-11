-- ============================================================
-- M061: Institutional Scopus Integration
-- Tables: institutional_scopus_config, user_institutional_access,
--         scopus_search_log
-- ============================================================

-- Institutional Scopus config (managed by PIOS admins / university IT)
create table if not exists institutional_scopus_config (
  id                      uuid primary key default gen_random_uuid(),
  institution             text not null,
  institution_domain      text not null unique,        -- e.g. port.ac.uk
  display_name            text not null,               -- e.g. "University of Portsmouth"

  -- Scopus direct-API credentials (added after uni IT approval)
  scopus_api_key_enc      text,                        -- AES-256 encrypted at app layer
  scopus_api_endpoint     text not null
                          default 'https://api.elsevier.com/content/search/scopus',

  -- Authentication
  auth_method             text not null default 'redirect',  -- redirect|api_key|oauth2|shibboleth
  sso_provider            text,                              -- shibboleth|saml|openid

  -- Web redirect URLs (Phase 1, always available)
  scopus_web_url          text,                        -- e.g. https://library.port.ac.uk/scopus
  library_portal_url      text,                        -- library homepage

  -- Capabilities
  can_search              boolean not null default true,
  can_export              boolean not null default true,
  api_enabled             boolean not null default false,    -- set true once IT approves API

  -- Rate limits (filled once API key is issued)
  max_api_calls_per_month integer,
  calls_this_month        integer not null default 0,

  -- Admin
  contact_email           text,
  notes                   text,
  active                  boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_institutional_scopus_domain on institutional_scopus_config(institution_domain);

-- Seed known institutions (read-only for non-admins — no RLS user filter needed)
-- RLS: only authenticated users may read; only service role may write
alter table institutional_scopus_config enable row level security;
create policy "Authenticated users may read institutions"
  on institutional_scopus_config for select
  using (auth.uid() is not null);

-- Per-user institutional access record (detected from email domain)
create table if not exists user_institutional_access (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references auth.users(id) on delete cascade,
  institution_id       uuid references institutional_scopus_config(id) on delete set null,

  -- Detected fields
  email_domain         text not null,                  -- domain extracted from auth email
  institution_name     text,
  institution_domain   text,

  -- Access status
  scopus_access        boolean not null default false,
  api_access_enabled   boolean not null default false,
  web_access_url       text,                           -- direct link for browser redirect

  -- Verification
  last_verified        timestamptz,
  verification_method  text,                           -- email_domain|sso|manual

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_user_institutional_user on user_institutional_access(user_id);
create index if not exists idx_user_institutional_domain on user_institutional_access(email_domain);

alter table user_institutional_access enable row level security;
create policy "Users manage own institutional access"
  on user_institutional_access for all
  using (auth.uid() = user_id);

-- Scopus search audit log (per institution for rate-limit compliance)
create table if not exists scopus_search_log (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  institution_id uuid references institutional_scopus_config(id) on delete set null,
  query          text not null,
  results_count  integer not null default 0,
  method         text not null default 'redirect',     -- redirect|api
  source_tag     text not null default 'scopus',
  executed_at    timestamptz not null default now()
);

create index if not exists idx_scopus_log_user        on scopus_search_log(user_id);
create index if not exists idx_scopus_log_institution on scopus_search_log(institution_id);
create index if not exists idx_scopus_log_executed    on scopus_search_log(executed_at);

alter table scopus_search_log enable row level security;
create policy "Users see own scopus logs"
  on scopus_search_log for all
  using (auth.uid() = user_id);

-- Updated-at triggers
create or replace function update_institutional_scopus_updated_at()
  returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_institutional_scopus_updated_at
  before update on institutional_scopus_config
  for each row execute function update_institutional_scopus_updated_at();

create trigger trg_user_institutional_access_updated_at
  before update on user_institutional_access
  for each row execute function update_institutional_scopus_updated_at();

-- ── Seed known institutions ───────────────────────────────────────────────────
insert into institutional_scopus_config
  (institution, institution_domain, display_name, auth_method, scopus_web_url, library_portal_url, contact_email, notes, api_enabled)
values
  ('University of Portsmouth', 'port.ac.uk',    'University of Portsmouth', 'redirect', 'https://www.scopus.com/search/form.uri#basic', 'https://library.port.ac.uk',           'library-it@port.ac.uk',    'DBA programme host institution', false),
  ('University College London',  'ucl.ac.uk',   'University College London', 'redirect', 'https://www.scopus.com/search/form.uri#basic', 'https://www.ucl.ac.uk/library',       null, null, false),
  ('University of Oxford',       'ox.ac.uk',    'University of Oxford',       'redirect', 'https://www.scopus.com/search/form.uri#basic', 'https://www.bodleian.ox.ac.uk',      null, null, false),
  ('University of Edinburgh',    'ed.ac.uk',    'University of Edinburgh',     'redirect', 'https://www.scopus.com/search/form.uri#basic', 'https://www.ed.ac.uk/information-services/library-museum-gallery', null, null, false),
  ('Cranfield University',       'cranfield.ac.uk', 'Cranfield University',   'redirect', 'https://www.scopus.com/search/form.uri#basic', 'https://www.cranfield.ac.uk/library', null, null, false),
  ('Manchester Metropolitan',    'mmu.ac.uk',   'Manchester Metropolitan University', 'redirect', 'https://www.scopus.com/search/form.uri#basic', 'https://www.mmu.ac.uk/library', null, null, false),
  ('Heriot-Watt University',     'hw.ac.uk',    'Heriot-Watt University',     'redirect', 'https://www.scopus.com/search/form.uri#basic', 'https://www.hw.ac.uk/library',        null, null, false),
  ('Brunel University London',   'brunel.ac.uk','Brunel University London',   'redirect', 'https://www.scopus.com/search/form.uri#basic', 'https://www.brunel.ac.uk/life/library', null, null, false)
on conflict (institution_domain) do nothing;
