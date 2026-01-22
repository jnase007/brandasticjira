-- ============================================
-- CLIENT NOTES & PIPELINE TRACKING
-- For tracking prospects through to active clients
-- ============================================

-- Add pipeline_stage to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'active' 
CHECK (pipeline_stage IN ('prospect', 'kickoff', 'discovery', 'proposal', 'implementation', 'active', 'paused', 'churned'));

-- Add onboarding notes field
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS onboarding_notes TEXT;

-- Add key contact fields
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS contact_name TEXT;

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- Add source/referral tracking
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS lead_source TEXT;

-- Add expected start date for prospects
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS expected_start_date DATE;

-- Add contract value for pipeline tracking
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS contract_value DECIMAL(12,2);

-- ============================================
-- CLIENT NOTES TABLE
-- Activity log and communication history
-- ============================================

CREATE TABLE IF NOT EXISTS public.client_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Note content
  title TEXT,
  content TEXT NOT NULL,
  
  -- Note type for categorization
  note_type TEXT DEFAULT 'note' CHECK (note_type IN (
    'note',           -- General note
    'call',           -- Phone call summary
    'meeting',        -- Meeting notes
    'email',          -- Email summary
    'kickoff',        -- Kickoff meeting
    'discovery',      -- Discovery session
    'proposal',       -- Proposal sent/discussed
    'feedback',       -- Client feedback
    'handoff',        -- Team handoff notes
    'milestone',      -- Project milestone
    'issue',          -- Issue/concern
    'win'             -- Win/positive update
  )),
  
  -- Optional: link to a stage change
  stage_change_from TEXT,
  stage_change_to TEXT,
  
  -- Visibility
  is_pinned BOOLEAN DEFAULT false,
  is_internal BOOLEAN DEFAULT true, -- Internal notes not shown to client
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

-- Team can view all client notes
DROP POLICY IF EXISTS "Team can view client notes" ON public.client_notes;
CREATE POLICY "Team can view client notes" ON public.client_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('team', 'admin')
    )
  );

-- Team can create notes
DROP POLICY IF EXISTS "Team can create client notes" ON public.client_notes;
CREATE POLICY "Team can create client notes" ON public.client_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('team', 'admin')
    )
  );

-- Team can update their own notes (or admins can update any)
DROP POLICY IF EXISTS "Team can update own notes" ON public.client_notes;
CREATE POLICY "Team can update own notes" ON public.client_notes
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Admins can delete notes
DROP POLICY IF EXISTS "Admins can delete notes" ON public.client_notes;
CREATE POLICY "Admins can delete notes" ON public.client_notes
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_notes_client_id ON public.client_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_created_at ON public.client_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_notes_note_type ON public.client_notes(note_type);

-- ============================================
-- PIPELINE VIEW
-- Summary of clients by pipeline stage
-- ============================================

CREATE OR REPLACE VIEW public.client_pipeline AS
SELECT 
  pipeline_stage,
  COUNT(*) as client_count,
  COALESCE(SUM(contract_value), 0) as total_value,
  COALESCE(SUM(monthly_hours * 175), 0) as monthly_revenue_potential
FROM public.clients
WHERE is_active = true OR pipeline_stage IN ('prospect', 'kickoff', 'discovery', 'proposal')
GROUP BY pipeline_stage
ORDER BY 
  CASE pipeline_stage
    WHEN 'prospect' THEN 1
    WHEN 'kickoff' THEN 2
    WHEN 'discovery' THEN 3
    WHEN 'proposal' THEN 4
    WHEN 'implementation' THEN 5
    WHEN 'active' THEN 6
    WHEN 'paused' THEN 7
    WHEN 'churned' THEN 8
  END;

GRANT SELECT ON public.client_pipeline TO authenticated;
GRANT SELECT ON public.client_notes TO authenticated;

-- Comments
COMMENT ON TABLE public.client_notes IS 'Activity log and communication history for each client';
COMMENT ON COLUMN public.clients.pipeline_stage IS 'Current stage in the client pipeline';
COMMENT ON COLUMN public.clients.onboarding_notes IS 'Quick notes during onboarding process';
