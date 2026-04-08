-- Audit tables that may contain personal seed data from the original account.

SELECT '=== TASKS ===' AS section, COUNT(*) AS row_count FROM public.tasks
UNION ALL
SELECT '=== PROJECTS ===', COUNT(*) FROM public.projects
UNION ALL
SELECT '=== PORTFOLIO_WORKSTREAMS ===', COUNT(*) FROM public.portfolio_workstreams
UNION ALL
SELECT '=== INSIGHTS ===', COUNT(*) FROM public.insights
UNION ALL
SELECT '=== SUPERVISION_SESSIONS ===', COUNT(*) FROM public.supervision_sessions
UNION ALL
SELECT '=== THESIS_CHAPTERS ===', COUNT(*) FROM public.thesis_chapters
UNION ALL
SELECT '=== MORNING_BRIEFS ===', COUNT(*) FROM public.morning_briefs
UNION ALL
SELECT '=== EXECUTIVE_DECISIONS ===', COUNT(*) FROM public.executive_decisions
UNION ALL
SELECT '=== EXECUTIVE_OKRS ===', COUNT(*) FROM public.executive_okrs
UNION ALL
SELECT '=== EXPENSES ===', COUNT(*) FROM public.expenses
UNION ALL
SELECT '=== FINANCIAL_SNAPSHOTS ===', COUNT(*) FROM public.financial_snapshots
UNION ALL
SELECT '=== IP_ASSETS ===', COUNT(*) FROM public.ip_assets
UNION ALL
SELECT '=== PUBLICATIONS ===', COUNT(*) FROM public.publications
UNION ALL
SELECT '=== NEMOCLAW_CALIBRATION ===', COUNT(*) FROM public.nemoclaw_calibration
ORDER BY section;

SELECT 'tasks' AS tbl, user_id::text, COUNT(*) FROM public.tasks GROUP BY user_id
UNION ALL
SELECT 'projects', user_id::text, COUNT(*) FROM public.projects GROUP BY user_id
UNION ALL
SELECT 'insights', user_id::text, COUNT(*) FROM public.insights GROUP BY user_id
ORDER BY tbl;