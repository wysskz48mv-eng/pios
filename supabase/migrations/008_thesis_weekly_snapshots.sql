-- ============================================================
-- Migration 008: thesis_weekly_snapshots
-- Captures weekly word-count totals per user for the weekly digest.
-- The cron/weekly route reads the previous week's snapshot to compute delta.
-- Run: POST /api/admin/migrate with SEED_SECRET
-- PIOS v2.0 | VeritasIQ Technologies Ltd
-- ============================================================

-- Table
create table if not exists public.thesis_weekly_snapshots (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  week_start    date not null,          -- Monday of the snapshot week (ISO: Mon)
  total_words   integer not null default 0,
  chapter_count integer not null default 0,
  captured_at   timestamptz not null default now(),
  constraint thesis_weekly_snapshots_user_week unique (user_id, week_start)
);

-- RLS
alter table public.thesis_weekly_snapshots enable row level security;

create policy "Users can read own snapshots"
  on public.thesis_weekly_snapshots for select
  using (auth.uid() = user_id);

-- Service role can insert (cron)
create policy "Service role can insert snapshots"
  on public.thesis_weekly_snapshots for insert
  with check (true);

-- Index for cron lookup (last week's snapshot per user)
create index if not exists idx_thesis_weekly_snapshots_user_week
  on public.thesis_weekly_snapshots (user_id, week_start desc);
