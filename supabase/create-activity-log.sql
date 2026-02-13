-- ============================================
-- CREATE ACTIVITY_LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_id UUID, -- No foreign key constraint in case clients table structure differs
  entity_type TEXT,
  entity_id UUID,
  entity_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read activity" ON public.activity_log
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert activity" ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_client ON public.activity_log(client_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);

SELECT 'Activity log table created!' as status;
