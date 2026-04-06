-- M026: Universal Insights Capture (UIC) v1 — Post-NemoClaw™ Sprint 84
-- Adds insight capture, context binding, and enrichment pipelines
-- Replaces ad-hoc insight storage with structured, queryable, archivable system
-- Status: PENDING execution

CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('strategic', 'operational', 'technical', 'financial', 'personal', 'research', 'other')),
  source TEXT NOT NULL CHECK (source IN ('literature', 'observation', 'meeting', 'research', 'brainstorm', 'feedback', 'manual')),
  confidence_level INTEGER CHECK (confidence_level >= 0 AND confidence_level <= 5),
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  related_concepts TEXT[] DEFAULT ARRAY[]::TEXT[],
  archived BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT insight_length CHECK (char_length(title) >= 3 AND char_length(title) <= 500)
);

CREATE TABLE IF NOT EXISTS insight_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id UUID NOT NULL REFERENCES insights(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('document', 'url', 'citation', 'data', 'observation', 'quote')),
  source_url TEXT,
  source_title TEXT,
  excerpt TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS insight_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id UUID NOT NULL REFERENCES insights(id) ON DELETE CASCADE,
  decision_id UUID REFERENCES decisions(id) ON DELETE SET NULL,
  relationship TEXT CHECK (relationship IN ('informs', 'constrains', 'accelerates', 'opposes', 'dependent_on')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS insight_okr_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id UUID NOT NULL REFERENCES insights(id) ON DELETE CASCADE,
  okr_id UUID REFERENCES okrs(id) ON DELETE SET NULL,
  relevance_score INTEGER CHECK (relevance_score >= 0 AND relevance_score <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS insight_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id UUID NOT NULL REFERENCES insights(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  mentioned_at TIMESTAMP WITH TIME ZONE,
  context TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for query performance
CREATE INDEX idx_insights_user_id ON insights(user_id);
CREATE INDEX idx_insights_category ON insights(category);
CREATE INDEX idx_insights_archived ON insights(archived) WHERE NOT archived;
CREATE INDEX idx_insights_created_at ON insights(created_at DESC);
CREATE INDEX idx_insights_tags ON insights USING GIN(tags);
CREATE INDEX idx_insight_evidence_insight_id ON insight_evidence(insight_id);
CREATE INDEX idx_insight_decisions_insight_id ON insight_decisions(insight_id);
CREATE INDEX idx_insight_okr_links_insight_id ON insight_okr_links(insight_id);
CREATE INDEX idx_insight_conversations_insight_id ON insight_conversations(insight_id);

-- RLS Policies
DROP POLICY IF EXISTS "insights_select_own" ON insights;
CREATE POLICY "insights_select_own" ON insights
  FOR SELECT USING (user_id = auth.uid() OR is_public = TRUE);

DROP POLICY IF EXISTS "insights_insert_own" ON insights;
CREATE POLICY "insights_insert_own" ON insights
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "insights_update_own" ON insights;
CREATE POLICY "insights_update_own" ON insights
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insights_delete_own" ON insights;
CREATE POLICY "insights_delete_own" ON insights
  FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insight_evidence_select_own" ON insight_evidence;
CREATE POLICY "insight_evidence_select_own" ON insight_evidence
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM insights WHERE id = insight_id AND (user_id = auth.uid() OR is_public = TRUE))
  );

DROP POLICY IF EXISTS "insight_evidence_insert_own" ON insight_evidence;
CREATE POLICY "insight_evidence_insert_own" ON insight_evidence
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM insights WHERE id = insight_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insight_evidence_update_own" ON insight_evidence;
CREATE POLICY "insight_evidence_update_own" ON insight_evidence
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM insights WHERE id = insight_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insight_evidence_delete_own" ON insight_evidence;
CREATE POLICY "insight_evidence_delete_own" ON insight_evidence
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM insights WHERE id = insight_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insight_decisions_select_own" ON insight_decisions;
CREATE POLICY "insight_decisions_select_own" ON insight_decisions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM insights WHERE id = insight_id AND (user_id = auth.uid() OR is_public = TRUE))
  );

DROP POLICY IF EXISTS "insight_decisions_insert_own" ON insight_decisions;
CREATE POLICY "insight_decisions_insert_own" ON insight_decisions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM insights WHERE id = insight_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insight_okr_links_select_own" ON insight_okr_links;
CREATE POLICY "insight_okr_links_select_own" ON insight_okr_links
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM insights WHERE id = insight_id AND (user_id = auth.uid() OR is_public = TRUE))
  );

DROP POLICY IF EXISTS "insight_okr_links_insert_own" ON insight_okr_links;
CREATE POLICY "insight_okr_links_insert_own" ON insight_okr_links
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM insights WHERE id = insight_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insight_conversations_select_own" ON insight_conversations;
CREATE POLICY "insight_conversations_select_own" ON insight_conversations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM insights WHERE id = insight_id AND (user_id = auth.uid() OR is_public = TRUE))
  );

DROP POLICY IF EXISTS "insight_conversations_insert_own" ON insight_conversations;
CREATE POLICY "insight_conversations_insert_own" ON insight_conversations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM insights WHERE id = insight_id AND user_id = auth.uid())
  );

-- Audit trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_insight_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS insight_update_timestamp ON insights;
CREATE TRIGGER insight_update_timestamp
  BEFORE UPDATE ON insights
  FOR EACH ROW
  EXECUTE FUNCTION update_insight_timestamp();
