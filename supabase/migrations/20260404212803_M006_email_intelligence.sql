alter table email_triage_queue
  add column if not exists relevance_score      smallint default 0,
  add column if not exists signal_type          text default 'noise'
    check (signal_type in (
      'action_required',
      'high_value',
      'document',
      'meeting_related',
      'financial',
      'deadline',
      'fyi',
      'noise'
    )),
  add column if not exists surface_to_dashboard bool default false,
  add column if not exists summary              text,
  add column if not exists suggested_action     text,
  add column if not exists sender_domain        text,
  add column if not exists is_newsletter        bool default false,
  add column if not exists is_automated         bool default false,
  add column if not exists has_attachment       bool default false,
  add column if not exists urgency              text default 'normal'
    check (urgency in ('urgent','high','normal','low'));

create or replace view dashboard_email_signals as
  select
    id, user_id, gmail_message_id, sender, subject,
    received_at, signal_type, relevance_score, urgency,
    summary, suggested_action, has_attachment, attachment_count
  from email_triage_queue
  where surface_to_dashboard = true
    and status in ('queued','processing')
  order by
    case urgency when 'urgent' then 1 when 'high' then 2 when 'normal' then 3 else 4 end,
    relevance_score desc,
    received_at desc;

grant select on dashboard_email_signals to authenticated;

create table if not exists sender_reputation (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  sender_email text not null,
  sender_name  text,
  sender_domain text,
  zone         smallint default 4,
  importance   smallint default 50,
  is_vip       bool default false,
  is_blocked   bool default false,
  email_count  int default 0,
  filed_count  int default 0,
  last_seen    timestamptz,
  created_at   timestamptz default now(),
  unique(user_id, sender_email)
);

alter table sender_reputation enable row level security;
create policy "Users own their sender reputation"
  on sender_reputation for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());;
