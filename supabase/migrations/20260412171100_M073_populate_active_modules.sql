begin;

create or replace function public.validate_framework_codes(modules text[])
returns boolean
language sql
immutable
as $$
  select coalesce(
    (
      select bool_and(code ~ '^VIQ-[A-Z]{2}-[0-9]{2}$')
      from unnest(coalesce(modules, '{}'::text[])) as code
    ),
    true
  );
$$;

create or replace function public.enforce_active_modules_validation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.validate_framework_codes(new.active_modules) then
    raise exception 'Invalid framework code in active_modules';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_active_modules on public.user_profiles;
create trigger trg_validate_active_modules
before insert or update of active_modules on public.user_profiles
for each row
execute function public.enforce_active_modules_validation();

alter table public.user_profiles
  drop constraint if exists active_modules_valid;

alter table public.user_profiles
  add constraint active_modules_valid
  check (public.validate_framework_codes(active_modules));

update public.user_profiles
set active_modules = case persona_type
  when 'CEO'            then array['VIQ-ST-01', 'VIQ-ST-02', 'VIQ-ST-03', 'VIQ-SC-01', 'VIQ-SC-02', 'VIQ-OD-01', 'VIQ-RK-01']
  when 'EXECUTIVE'      then array['VIQ-ST-01', 'VIQ-ST-02', 'VIQ-ST-03', 'VIQ-SC-01', 'VIQ-SC-02', 'VIQ-OD-01', 'VIQ-RK-01']
  when 'CHIEF_OF_STAFF' then array['VIQ-ST-01', 'VIQ-ST-02', 'VIQ-ST-03', 'VIQ-SC-01', 'VIQ-SC-02', 'VIQ-OD-01', 'VIQ-RK-01']
  when 'WHOLE_LIFE'     then array['VIQ-ST-01', 'VIQ-ST-02', 'VIQ-ST-03', 'VIQ-SC-01', 'VIQ-SC-02', 'VIQ-OD-01', 'VIQ-RK-01']
  when 'CONSULTANT'     then array['VIQ-PS-01', 'VIQ-PS-02', 'VIQ-ST-01', 'VIQ-SC-01', 'VIQ-FA-01', 'VIQ-EV-01']
  when 'ACADEMIC'       then array['VIQ-PS-04', 'VIQ-EV-01', 'VIQ-EV-02', 'VIQ-ST-07']
  else active_modules
end,
updated_at = now()
where coalesce(array_length(active_modules, 1), 0) = 0
   or not public.validate_framework_codes(active_modules);

update public.user_profiles
set persona_type = 'CEO',
    active_modules = array['VIQ-ST-01', 'VIQ-ST-02', 'VIQ-ST-03', 'VIQ-SC-01', 'VIQ-SC-02', 'VIQ-OD-01', 'VIQ-RK-01'],
    updated_at = now()
where id = 'bc8b18d0-8e0d-4eb5-bd15-bbf9c374dbce';

create or replace function public.rollback_active_modules_migration()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  alter table public.user_profiles
    drop constraint if exists active_modules_valid;

  drop trigger if exists trg_validate_active_modules on public.user_profiles;
  drop function if exists public.enforce_active_modules_validation();
  drop function if exists public.validate_framework_codes(text[]);

  return 'rollback_active_modules_migration complete';
end;
$$;

commit;
