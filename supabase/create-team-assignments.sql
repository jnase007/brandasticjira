-- ============================================
-- CREATE CLIENT TEAM ASSIGNMENTS TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- Create the client_team_assignments table
CREATE TABLE IF NOT EXISTS public.client_team_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN (
    'marketing_manager', 
    'account_specialist', 
    'marketing_coordinator', 
    'paid_media', 
    'seo', 
    'design',
    'developer',
    'content',
    'social_media',
    'account_manager'
  )),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique assignment per client/role combination
  UNIQUE(client_id, role)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_client_team_assignments_client ON public.client_team_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_team_assignments_user ON public.client_team_assignments(user_id);

-- Enable RLS
ALTER TABLE public.client_team_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "team_assignments_select" ON public.client_team_assignments;
CREATE POLICY "team_assignments_select" ON public.client_team_assignments
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "team_assignments_insert" ON public.client_team_assignments;
CREATE POLICY "team_assignments_insert" ON public.client_team_assignments
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "team_assignments_update" ON public.client_team_assignments;
CREATE POLICY "team_assignments_update" ON public.client_team_assignments
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "team_assignments_delete" ON public.client_team_assignments;
CREATE POLICY "team_assignments_delete" ON public.client_team_assignments
  FOR DELETE TO authenticated
  USING (true);

-- ============================================
-- VERIFY
-- ============================================
SELECT 'client_team_assignments table created!' as status;

-- Show table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'client_team_assignments'
ORDER BY ordinal_position;
