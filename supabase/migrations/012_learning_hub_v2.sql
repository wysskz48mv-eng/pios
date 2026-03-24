-- M012: Learning Hub v2.0 — CPD body expanded support + journal tracking
-- PIOS v2.2 | VeritasIQ Technologies Ltd

-- Add journal tracking to learning_journeys (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'learning_journeys') THEN
    -- Add journal/reflection entry count
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='learning_journeys' AND column_name='journal_entries') THEN
      ALTER TABLE learning_journeys ADD COLUMN journal_entries INTEGER DEFAULT 0;
    END IF;
    
    -- Add supervisor approval tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='learning_journeys' AND column_name='supervisor_approved') THEN
      ALTER TABLE learning_journeys ADD COLUMN supervisor_approved BOOLEAN DEFAULT false;
      ALTER TABLE learning_journeys ADD COLUMN supervisor_approved_at TIMESTAMPTZ;
    END IF;
    
    -- Add target completion date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='learning_journeys' AND column_name='target_completion_date') THEN
      ALTER TABLE learning_journeys ADD COLUMN target_completion_date DATE;
    END IF;
    
    RAISE NOTICE 'M012: learning_journeys v2 fields added';
  END IF;
  
  -- Create CPD body reference table if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cpd_bodies') THEN
    CREATE TABLE cpd_bodies (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code         TEXT UNIQUE NOT NULL,
      name         TEXT NOT NULL,
      full_name    TEXT,
      country      TEXT DEFAULT 'UK',
      annual_hours INTEGER,
      website      TEXT,
      active        BOOLEAN DEFAULT true,
      created_at   TIMESTAMPTZ DEFAULT now()
    );
    
    INSERT INTO cpd_bodies (code, name, full_name, country, annual_hours, website) VALUES
      ('CIMA',   'CIMA',   'Chartered Institute of Management Accountants',        'UK', 120, 'cimaglobal.com'),
      ('ICAEW',  'ICAEW',  'Institute of Chartered Accountants in England & Wales','UK', 120, 'icaew.com'),
      ('ICE',    'ICE',    'Institution of Civil Engineers',                        'UK',  30, 'ice.org.uk'),
      ('RICS',   'RICS',   'Royal Institution of Chartered Surveyors',              'UK',  20, 'rics.org'),
      ('CIPD',   'CIPD',   'Chartered Institute of Personnel & Development',        'UK',  30, 'cipd.org'),
      ('NMC',    'NMC',    'Nursing & Midwifery Council',                           'UK',  35, 'nmc.org.uk'),
      ('SRA',    'SRA',    'Solicitors Regulation Authority',                       'UK',  16, 'sra.org.uk'),
      ('ACCA',   'ACCA',   'Association of Chartered Certified Accountants',        'UK', 120, 'accaglobal.com'),
      ('BCS',    'BCS',    'British Computer Society',                              'UK',  30, 'bcs.org'),
      ('CIOB',   'CIOB',   'Chartered Institute of Building',                       'UK',  30, 'ciob.org'),
      ('RIBA',   'RIBA',   'Royal Institute of British Architects',                 'UK',  35, 'architecture.com'),
      ('CMI',    'CMI',    'Chartered Management Institute',                        'UK',  30, 'managers.org.uk');
    
    RAISE NOTICE 'M012: cpd_bodies reference table created with 12 bodies';
  END IF;

END;
$$;

-- Enable RLS on cpd_bodies
ALTER TABLE IF EXISTS cpd_bodies ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "cpd_bodies_public_read"
  ON cpd_bodies FOR SELECT USING (true);


-- Learning journal entries table
CREATE TABLE IF NOT EXISTS learning_journal_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  mood         TEXT,
  tags         TEXT[] DEFAULT '{}',
  ai_reflection TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE learning_journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "journal_own_data"
  ON learning_journal_entries
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS learning_journal_user_idx
  ON learning_journal_entries(user_id, created_at DESC);

SELECT 'M012: Learning Hub v2.0 + CPD bodies ready' AS result;
