-- ============================================================
-- PIOS: Replace ALL remaining tenant_id-based RLS with user_id
-- Fixes: consulting, decision analysis, time audits, IP assets,
-- contracts, financial snapshots, knowledge entries, SIA, BICA
-- ============================================================

do $$ declare t text; begin
  foreach t in array array[
    'consulting_engagements',
    'exec_decision_analyses',
    'exec_time_audits',
    'ip_assets',
    'contracts',
    'financial_snapshots',
    'knowledge_entries',
    'sia_signal_briefs',
    'bica_comms'
  ] loop
    -- Only process tables that actually exist
    if to_regclass('public.' || t) is not null then
      -- Enable RLS
      execute format('alter table public.%s enable row level security', t);

      -- Drop old tenant-based policy
      execute format('drop policy if exists "tenant_rls_%s" on public.%s', t, t);

      -- Create new user_id-based policy
      execute format('
        create policy "user_rls_%s" on public.%s
          for all using (auth.uid() = user_id)
          with check (auth.uid() = user_id)', t, t);

      raise notice 'Fixed RLS for: %', t;
    else
      raise notice 'Skipped (table does not exist): %', t;
    end if;
  end loop;
end $$;
