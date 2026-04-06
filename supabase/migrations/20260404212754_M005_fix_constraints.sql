alter table email_triage_queue
  drop constraint if exists email_triage_queue_user_message_unique;

alter table email_triage_queue
  add constraint email_triage_queue_user_message_unique
  unique (user_id, gmail_message_id);

alter table identity_contexts
  drop constraint if exists identity_contexts_user_provider_email_unique;

alter table identity_contexts
  add constraint identity_contexts_user_provider_email_unique
  unique (user_id, provider, account_email);

create index if not exists idx_triage_message_id on email_triage_queue(gmail_message_id);

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language 'plpgsql';

drop trigger if exists update_integrations_updated_at on integrations;
create trigger update_integrations_updated_at
  before update on integrations
  for each row execute function update_updated_at_column();;
