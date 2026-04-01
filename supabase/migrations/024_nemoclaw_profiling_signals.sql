-- M024: NemoClaw™ Progressive Profiling Signal Log
-- Captures user signals across 4 confidence layers for CV calibration

CREATE TABLE IF NOT EXISTS public.profiling_signals (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_layer SMALLINT NOT NULL CHECK (signal_layer IN (1, 2, 3, 4)),
  signal_source TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  raw_value JSONB,
  inferred_domain TEXT,
  inferred_seniority TEXT,
  confidence NUMERIC(3, 2) NOT NULL DEFAULT 0.50,
  reviewed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiling_signals_user ON public.profiling_signals(user_id, signal_layer, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiling_signals_layer ON public.profiling_signals(signal_layer, confidence DESC);

ALTER TABLE public.profiling_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profiling signals" ON public.profiling_signals
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profiling signals" ON public.profiling_signals
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own profiling signals" ON public.profiling_signals
  FOR UPDATE USING (user_id = auth.uid());
