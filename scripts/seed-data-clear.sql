-- Destructive. Run seed-data-audit.sql first.

BEGIN;

DO $$
DECLARE
  dev_user uuid := '47621611-96bc-465c-913e-0d23a89465f5';
BEGIN
  DELETE FROM public.tasks WHERE user_id = dev_user;
  DELETE FROM public.projects WHERE user_id = dev_user;
  DELETE FROM public.portfolio_workstreams WHERE user_id = dev_user;
  DELETE FROM public.insights WHERE user_id = dev_user;
  DELETE FROM public.supervision_sessions WHERE user_id = dev_user;
  DELETE FROM public.thesis_chapters WHERE user_id = dev_user;
  DELETE FROM public.morning_briefs WHERE user_id = dev_user;
  DELETE FROM public.executive_decisions WHERE user_id = dev_user;
  DELETE FROM public.executive_okrs WHERE user_id = dev_user;
  DELETE FROM public.expenses WHERE user_id = dev_user;
  DELETE FROM public.financial_snapshots WHERE user_id = dev_user;
  DELETE FROM public.ip_assets WHERE user_id = dev_user;
  DELETE FROM public.publications WHERE user_id = dev_user;
  DELETE FROM public.nemoclaw_calibration WHERE user_id = dev_user;
  DELETE FROM public.domain_contexts WHERE user_id = dev_user;
  DELETE FROM public.profiling_signals WHERE user_id = dev_user;
  DELETE FROM public.stakeholders WHERE user_id = dev_user;
  DELETE FROM public.nemo_conversations WHERE user_id = dev_user;

  RAISE NOTICE 'Seed data cleared for user %', dev_user;
END $$;

SELECT 'tasks' AS tbl, COUNT(*) FROM public.tasks
UNION ALL SELECT 'projects', COUNT(*) FROM public.projects
UNION ALL SELECT 'insights', COUNT(*) FROM public.insights
UNION ALL SELECT 'morning_briefs', COUNT(*) FROM public.morning_briefs;

COMMIT;