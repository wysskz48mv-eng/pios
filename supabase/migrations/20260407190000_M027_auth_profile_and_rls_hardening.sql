-- M027: auth profile bootstrap + RLS hardening

create or replace function public.current_profile_tenant_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select tenant_id
  from public.user_profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.drop_all_policies(p_schema text, p_table text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = p_schema
      and tablename = p_table
  loop
    execute format('drop policy if exists %I on %I.%I', policy_record.policyname, p_schema, p_table);
  end loop;
end;
$$;

create or replace function public.bootstrap_user_profile(
  p_user_id uuid,
  p_email text default null,
  p_raw_user_meta_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  insert_columns text[] := array['id'];
  insert_values text[] := array['$1'];
  insert_sql text;
  full_name text := coalesce(
    nullif(trim(p_raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(p_raw_user_meta_data ->> 'name'), ''),
    nullif(trim(split_part(coalesce(p_email, ''), '@', 1)), ''),
    'User'
  );
  display_name text := coalesce(
    nullif(trim(p_raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(p_raw_user_meta_data ->> 'name'), ''),
    full_name
  );
  google_email text := coalesce(
    nullif(trim(p_raw_user_meta_data ->> 'email'), ''),
    nullif(trim(p_email), '')
  );
begin
  if to_regclass('public.user_profiles') is null then
    return;
  end if;

  if exists(select 1 from public.user_profiles where id = p_user_id) then
    return;
  end if;

  if exists(
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'user_id'
  ) then
    if exists(select 1 from public.user_profiles where user_id = p_user_id) then
      return;
    end if;

    insert_columns := array_append(insert_columns, 'user_id');
    insert_values := array_append(insert_values, '$1');
  end if;

  if exists(
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'full_name'
  ) then
    insert_columns := array_append(insert_columns, 'full_name');
    insert_values := array_append(insert_values, '$2');
  end if;

  if exists(
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'display_name'
  ) then
    insert_columns := array_append(insert_columns, 'display_name');
    insert_values := array_append(insert_values, '$3');
  end if;

  if exists(
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'google_email'
  ) then
    insert_columns := array_append(insert_columns, 'google_email');
    insert_values := array_append(insert_values, '$4');
  end if;

  insert_sql := format(
    'insert into public.user_profiles (%s) values (%s) on conflict do nothing',
    array_to_string(insert_columns, ', '),
    array_to_string(insert_values, ', ')
  );

  execute insert_sql using p_user_id, full_name, display_name, google_email;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  perform public.bootstrap_user_profile(new.id, new.email, coalesce(new.raw_user_meta_data, '{}'::jsonb));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

do $$
declare
  auth_user record;
begin
  for auth_user in
    select id, email, raw_user_meta_data
    from auth.users
  loop
    perform public.bootstrap_user_profile(
      auth_user.id,
      auth_user.email,
      coalesce(auth_user.raw_user_meta_data, '{}'::jsonb)
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'behavioural_signals',
    'connected_email_accounts',
    'domain_contexts',
    'meetings',
    'profile_events'
  ]
  loop
    if to_regclass(format('public.%s', table_name)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', table_name);
    perform public.drop_all_policies('public', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      table_name || '_own',
      table_name
    );
  end loop;
end;
$$;

do $$
begin
  if to_regclass('public.tenant_configs') is not null then
    alter table public.tenant_configs enable row level security;
    perform public.drop_all_policies('public', 'tenant_configs');
    create policy tenant_configs_tenant_scope
      on public.tenant_configs
      for all
      to authenticated
      using (tenant_id = public.current_profile_tenant_id())
      with check (tenant_id = public.current_profile_tenant_id());
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.vault_document_folders') is not null then
    alter table public.vault_document_folders enable row level security;
    perform public.drop_all_policies('public', 'vault_document_folders');

    if exists(
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'vault_document_folders'
        and column_name = 'user_id'
    ) then
      create policy vault_document_folders_authenticated
        on public.vault_document_folders
        for all
        to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    elsif exists(
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'vault_document_folders'
        and column_name = 'folder_id'
    ) and to_regclass('public.vault_folders') is not null then
      create policy vault_document_folders_authenticated
        on public.vault_document_folders
        for all
        to authenticated
        using (
          exists (
            select 1
            from public.vault_folders folder
            where folder.id = vault_document_folders.folder_id
              and folder.user_id = auth.uid()
          )
        )
        with check (
          exists (
            select 1
            from public.vault_folders folder
            where folder.id = vault_document_folders.folder_id
              and folder.user_id = auth.uid()
          )
        );
    end if;
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.operator_configs') is not null then
    alter table public.operator_configs enable row level security;
    perform public.drop_all_policies('public', 'operator_configs');
    create policy operator_configs_authenticated_read
      on public.operator_configs
      for select
      to authenticated
      using (true);
  end if;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organisations',
    'organizations',
    'persona_configs',
    'viq_frameworks'
  ]
  loop
    if to_regclass(format('public.%s', table_name)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', table_name);
    perform public.drop_all_policies('public', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      table_name || '_authenticated_read',
      table_name
    );
  end loop;
end;
$$;

do $$
begin
  if to_regclass('public.waitlist') is not null then
    alter table public.waitlist enable row level security;
    perform public.drop_all_policies('public', 'waitlist');
    create policy waitlist_anon_insert
      on public.waitlist
      for insert
      to anon
      with check (true);
  end if;
end;
$$;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        policyname ilike 'pios_files%'
        or policyname ilike 'pios_cv%'
        or coalesce(qual, '') ilike '%pios-files%'
        or coalesce(with_check, '') ilike '%pios-files%'
        or coalesce(qual, '') ilike '%pios-cv%'
        or coalesce(with_check, '') ilike '%pios-cv%'
      )
  loop
    execute format('drop policy if exists %I on storage.objects', policy_record.policyname);
  end loop;
end;
$$;

create policy pios_files_owner_upload
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'pios-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy pios_files_owner_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'pios-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy pios_files_owner_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'pios-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy pios_cv_owner_upload
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'pios-cv'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy pios_cv_owner_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'pios-cv'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy pios_cv_owner_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'pios-cv'
    and auth.uid()::text = (storage.foldername(name))[1]
  );