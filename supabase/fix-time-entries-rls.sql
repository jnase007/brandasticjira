-- ============================================
-- FIX TIME ENTRIES RLS POLICIES
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable RLS on time_entries
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Team can view all time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Team can manage time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Team members can view time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Team members can manage time entries" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_select" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_insert" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_update" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_delete" ON public.time_entries;

-- Create simple, permissive policies for all authenticated users
CREATE POLICY "time_entries_select" ON public.time_entries
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "time_entries_insert" ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "time_entries_update" ON public.time_entries
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "time_entries_delete" ON public.time_entries
  FOR DELETE TO authenticated
  USING (true);

-- ============================================
-- VERIFY THE TABLE STRUCTURE
-- ============================================

-- Make sure all required columns exist
ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id);

ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL;

ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS minutes INTEGER DEFAULT 0;

ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;

ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS billable BOOLEAN DEFAULT true;

ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- VERIFY
-- ============================================
SELECT 'Time entries RLS fixed!' as status;

-- Show current entries count
SELECT COUNT(*) as total_entries FROM public.time_entries;

-- Show policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'time_entries';
