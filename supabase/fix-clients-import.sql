-- ============================================
-- FIX CLIENTS IMPORT & PERSISTENCE
-- Run this in Supabase SQL Editor
-- This fixes RLS policies, constraints, and missing columns
-- so clients persist for ALL team members
-- ============================================

-- ============================================
-- 1. FIX MONTHLY_HOURS CONSTRAINT
-- Remove the 20-60 hour limit to allow any value
-- ============================================
ALTER TABLE public.clients 
DROP CONSTRAINT IF EXISTS clients_monthly_hours_check;

-- Add a reasonable constraint (0-500 hours)
ALTER TABLE public.clients 
ADD CONSTRAINT clients_monthly_hours_check 
CHECK (monthly_hours >= 0 AND monthly_hours <= 500);

-- ============================================
-- 2. ADD MISSING COLUMNS
-- ============================================

-- Add account_services if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'account_services'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN account_services JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add monthly_revenue if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'monthly_revenue'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN monthly_revenue DECIMAL(12,2);
  END IF;
END $$;

-- ============================================
-- 3. FIX RLS POLICIES FOR CLIENTS
-- Allow team members to insert/update clients (not just admins)
-- ============================================

-- Drop ALL existing client policies first
DROP POLICY IF EXISTS "Team members can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Clients can view their own client record" ON public.clients;
DROP POLICY IF EXISTS "Admins can manage clients" ON public.clients;
DROP POLICY IF EXISTS "Team members can manage clients" ON public.clients;
DROP POLICY IF EXISTS "Team members can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Team members can update clients" ON public.clients;
DROP POLICY IF EXISTS "Team members can delete clients" ON public.clients;
DROP POLICY IF EXISTS "Clients can view own record" ON public.clients;

-- Create new policies: Team members can fully manage clients
CREATE POLICY "Team members can view all clients" ON public.clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

CREATE POLICY "Team members can insert clients" ON public.clients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

CREATE POLICY "Team members can update clients" ON public.clients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

CREATE POLICY "Team members can delete clients" ON public.clients
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Client users can view their own client record
CREATE POLICY "Clients can view own record" ON public.clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND client_id = clients.id
    )
  );

-- ============================================
-- 4. FIX BOARDS RLS - Allow team to create boards
-- ============================================

DROP POLICY IF EXISTS "Team members can manage boards" ON public.boards;
DROP POLICY IF EXISTS "Team members can insert boards" ON public.boards;
DROP POLICY IF EXISTS "Team members can update boards" ON public.boards;
DROP POLICY IF EXISTS "Team members can delete boards" ON public.boards;

CREATE POLICY "Team members can insert boards" ON public.boards
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

CREATE POLICY "Team members can update boards" ON public.boards
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

CREATE POLICY "Team members can delete boards" ON public.boards
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

-- ============================================
-- 5. FIX TICKETS RLS - Allow team to manage tickets
-- ============================================

DROP POLICY IF EXISTS "Team members can manage tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team members can insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team members can update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team members can delete tickets" ON public.tickets;

CREATE POLICY "Team members can insert tickets" ON public.tickets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

CREATE POLICY "Team members can update tickets" ON public.tickets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

CREATE POLICY "Team members can delete tickets" ON public.tickets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

-- ============================================
-- 6. CREATE CLIENT HOURLY RATES TABLE (if missing)
-- ============================================

CREATE TABLE IF NOT EXISTS public.client_hourly_rates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  rate_per_hour DECIMAL(10,2) NOT NULL DEFAULT 175.00,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, effective_date)
);

-- RLS for rates
ALTER TABLE public.client_hourly_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team can view rates" ON public.client_hourly_rates;
DROP POLICY IF EXISTS "Team can manage rates" ON public.client_hourly_rates;

CREATE POLICY "Team can view rates" ON public.client_hourly_rates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

CREATE POLICY "Team can manage rates" ON public.client_hourly_rates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

-- ============================================
-- 7. VERIFY & SHOW STATUS
-- ============================================

-- Show current clients count
SELECT 'Current clients count:' AS info, COUNT(*)::text AS value FROM public.clients
UNION ALL
SELECT 'Current boards count:', COUNT(*)::text FROM public.boards
UNION ALL
SELECT 'Current tickets count:', COUNT(*)::text FROM public.tickets;

-- Show success message
DO $$
BEGIN
  RAISE NOTICE '✅ Client import fix applied successfully!';
  RAISE NOTICE '   - Monthly hours constraint updated (0-500)';
  RAISE NOTICE '   - Account services column added';
  RAISE NOTICE '   - RLS policies updated for team members';
  RAISE NOTICE '   - Client hourly rates table created';
  RAISE NOTICE '';
  RAISE NOTICE 'Team members can now import and manage clients.';
  RAISE NOTICE 'All imported clients will persist for the entire team.';
END $$;
