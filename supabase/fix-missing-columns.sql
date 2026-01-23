-- ============================================
-- FIX MISSING COLUMNS
-- Run this to add all missing columns the app expects
-- ============================================

-- ============================================
-- TIME_ENTRIES TABLE FIXES
-- ============================================

-- Add billable column if missing
ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS billable BOOLEAN DEFAULT true;

-- Add minutes column if missing (some schemas use duration_minutes)
ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS minutes INTEGER DEFAULT 0;

-- Add date column if missing
ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;

-- Add description column if missing
ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add is_running column if missing
ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS is_running BOOLEAN DEFAULT false;

-- Make sure we have proper foreign keys
ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL;

ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ============================================
-- BOARDS TABLE FIXES
-- ============================================

-- Add is_archived column if missing
ALTER TABLE public.boards 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Add created_by column if missing
ALTER TABLE public.boards 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add board_type column if missing
ALTER TABLE public.boards 
ADD COLUMN IF NOT EXISTS board_type TEXT DEFAULT 'kanban';

-- ============================================
-- CLIENTS TABLE FIXES
-- ============================================

-- Add pipeline_stage if missing
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'active';

-- Add contact fields if missing
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS contact_name TEXT;

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- Add account_services if missing (as array)
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS account_services TEXT[];

-- ============================================
-- PROFILES TABLE FIXES
-- ============================================

-- Add cost_rate for profitability tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cost_rate DECIMAL(10,2) DEFAULT 50.00;

-- Add job_title
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Add department
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS department TEXT;

-- Add client_id for client users
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- ============================================
-- TICKETS TABLE FIXES
-- ============================================

-- Add position for kanban ordering
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Add tags array
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Add time_estimate
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS time_estimate INTEGER;

-- ============================================
-- CREATE CLIENT_NOTES TABLE IF NOT EXISTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.client_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT,
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'note',
  stage_change_from TEXT,
  stage_change_to TEXT,
  is_pinned BOOLEAN DEFAULT false,
  is_internal BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on client_notes
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Team can manage client notes" ON public.client_notes;

-- Create policy for client_notes
CREATE POLICY "Team can manage client notes" ON public.client_notes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- RLS POLICIES - Make sure tables are accessible
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies for time_entries
DROP POLICY IF EXISTS "Users can manage time entries" ON public.time_entries;
CREATE POLICY "Users can manage time entries" ON public.time_entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Drop and recreate policies for boards
DROP POLICY IF EXISTS "Users can manage boards" ON public.boards;
CREATE POLICY "Users can manage boards" ON public.boards
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Drop and recreate policies for clients
DROP POLICY IF EXISTS "Users can manage clients" ON public.clients;
CREATE POLICY "Users can manage clients" ON public.clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Drop and recreate policies for tickets
DROP POLICY IF EXISTS "Users can manage tickets" ON public.tickets;
CREATE POLICY "Users can manage tickets" ON public.tickets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Drop and recreate policies for profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (true);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_time_entries_client_id ON public.time_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON public.time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON public.time_entries(date);
CREATE INDEX IF NOT EXISTS idx_boards_client_id ON public.boards(client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_board_id ON public.tickets(board_id);
CREATE INDEX IF NOT EXISTS idx_tickets_client_id ON public.tickets(client_id);

-- ============================================
-- DONE!
-- ============================================
SELECT 'All missing columns and policies have been added!' as status;
