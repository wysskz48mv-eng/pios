-- ============================================================
-- PIOS Migration 002 — Dedup and clean seed data
-- Run in Supabase SQL Editor after initial seed
-- ============================================================

-- Remove duplicate tasks (keep most recent by created_at)
DELETE FROM public.tasks
WHERE id NOT IN (
  SELECT DISTINCT ON (title, user_id) id
  FROM public.tasks
  ORDER BY title, user_id, created_at DESC
);

-- Remove duplicate academic_modules (keep most recent)
DELETE FROM public.academic_modules
WHERE id NOT IN (
  SELECT DISTINCT ON (title, user_id) id
  FROM public.academic_modules
  ORDER BY title, user_id, created_at DESC
);

-- Remove duplicate thesis_chapters (keep most recent)
DELETE FROM public.thesis_chapters
WHERE id NOT IN (
  SELECT DISTINCT ON (chapter_num, user_id) id
  FROM public.thesis_chapters
  ORDER BY chapter_num, user_id, created_at DESC
);

-- Remove duplicate projects (keep most recent)
DELETE FROM public.projects
WHERE id NOT IN (
  SELECT DISTINCT ON (title, user_id) id
  FROM public.projects
  ORDER BY title, user_id, created_at DESC
);

-- Remove duplicate notifications (keep most recent)
DELETE FROM public.notifications
WHERE id NOT IN (
  SELECT DISTINCT ON (title, user_id) id
  FROM public.notifications
  ORDER BY title, user_id, created_at DESC
);

-- Verify final counts
SELECT 
  (SELECT COUNT(*) FROM public.tasks) as tasks,
  (SELECT COUNT(*) FROM public.academic_modules) as modules,
  (SELECT COUNT(*) FROM public.thesis_chapters) as chapters,
  (SELECT COUNT(*) FROM public.projects) as projects,
  (SELECT COUNT(*) FROM public.notifications) as notifications,
  (SELECT COUNT(*) FROM public.expenses) as expenses;
