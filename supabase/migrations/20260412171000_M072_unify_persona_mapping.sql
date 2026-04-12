begin;

create or replace function public.normalize_persona_type(input text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(input, ''))
    when 'ceo' then 'executive'
    when 'founder' then 'executive'
    when 'chief_of_staff' then 'executive'
    when 'whole_life' then 'executive'
    when 'executive' then 'executive'
    when 'consultant' then 'consultant'
    when 'professional' then 'consultant'
    when 'pro' then 'consultant'
    when 'academic' then 'academic'
    when 'starter' then 'academic'
    else 'executive'
  end;
$$;

create table if not exists public.persona_change_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  old_persona text,
  new_persona text not null,
  changed_at timestamptz not null default now()
);

alter table public.persona_change_audit enable row level security;

drop policy if exists persona_change_audit_own on public.persona_change_audit;
create policy persona_change_audit_own
  on public.persona_change_audit
  for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.audit_persona_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.persona_type is distinct from old.persona_type then
    insert into public.persona_change_audit(user_id, old_persona, new_persona, changed_at)
    values (new.id, old.persona_type, new.persona_type, now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_persona_change on public.user_profiles;
create trigger trg_audit_persona_change
before update of persona_type on public.user_profiles
for each row
execute function public.audit_persona_change();

update public.user_profiles
set persona_type = public.normalize_persona_type(persona_type),
    updated_at = now()
where persona_type is distinct from public.normalize_persona_type(persona_type);

alter table public.user_profiles
  drop constraint if exists persona_type_valid;

alter table public.user_profiles
  add constraint persona_type_valid
  check (persona_type in ('executive', 'consultant', 'academic'));

create or replace function public.rollback_persona_migration()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  alter table public.user_profiles
    drop constraint if exists persona_type_valid;

  drop trigger if exists trg_audit_persona_change on public.user_profiles;
  drop function if exists public.audit_persona_change();
  drop function if exists public.normalize_persona_type(text);

  return 'rollback_persona_migration complete';
end;
$$;

commit;
