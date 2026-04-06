-- M007: PIOS Performance Indexes (Critical Path Optimization)
-- Purpose: 5-10x speedup for brief generation, email scan, document queries
-- Author: Dimitry Masuku | Date: April 4, 2026
-- Estimated impact: Brief generation <1s, Email scan <2s, Dashboard load <500ms

-- ===== BRIEF GENERATION (Daily/Morning Briefs) =====
CREATE INDEX IF NOT EXISTS idx_daily_briefs_user_date ON daily_briefs(user_id, brief_date DESC);
CREATE INDEX IF NOT EXISTS idx_morning_briefs_user_date ON morning_briefs(user_id, brief_date DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_briefs_user_date ON meeting_briefs(user_id, created_at DESC);

-- ===== EMAIL SCAN & TRIAGE (M001-M006 Email Intelligence) =====
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_sync ON connected_email_accounts(user_id, is_active, sync_enabled);
CREATE INDEX IF NOT EXISTS idx_email_items_account_date ON email_items(account_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_items_user_priority ON email_items(user_id, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_email_items_triage ON email_items(user_id, triage_class);

-- ===== DOCUMENT MANAGEMENT (M003 Filing System) =====
CREATE INDEX IF NOT EXISTS idx_file_items_space_date ON file_items(space_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_items_user_name ON file_items(user_id, name);

-- ===== CONVERSATION CONTEXT (NemoClaw AI) =====
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_date ON ai_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_domain ON ai_sessions(user_id, domain);

-- ===== CALENDAR & SCHEDULING (M004 PA/CoS Mode) =====
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date ON calendar_events(user_id, start_time DESC);

-- ===== TASK & PROJECT CONTEXT =====
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_date ON projects(user_id, updated_at DESC);

-- ===== NOTIFICATIONS & ALERTS =====
CREATE INDEX IF NOT EXISTS idx_notifications_user_date ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staleness_alerts_user_date ON staleness_alerts(user_id, created_at DESC);

-- ===== DECISION & MEETING CONTEXT =====
CREATE INDEX IF NOT EXISTS idx_exec_decisions_user_date ON exec_decisions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_user_date ON meeting_notes(user_id, created_at DESC);

-- ===== SUBSCRIPTION & BILLING (M015 Stripe Integration) =====
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);

-- ===== FULL-TEXT SEARCH (M010 Advanced Search) =====
CREATE INDEX IF NOT EXISTS idx_vault_docs_search ON vault_documents USING GIN(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_meeting_notes_search ON meeting_notes USING GIN(to_tsvector('english', title));

-- ===== UPDATE QUERY PLANNER STATISTICS =====
ANALYZE daily_briefs;
ANALYZE morning_briefs;
ANALYZE connected_email_accounts;
ANALYZE email_items;
ANALYZE file_items;
ANALYZE ai_sessions;
ANALYZE calendar_events;
ANALYZE tasks;
ANALYZE projects;
ANALYZE notifications;
ANALYZE exec_decisions;
ANALYZE meeting_notes;
ANALYZE vault_documents;
ANALYZE subscriptions;
;
