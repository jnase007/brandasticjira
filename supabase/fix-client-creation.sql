-- ============================================
-- FIX CLIENT CREATION - ADD ALL MISSING COLUMNS
-- Run this in your Supabase SQL Editor
-- ============================================

-- Core client columns
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Pipeline/Prospect columns
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_status TEXT DEFAULT 'active';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS engagement_type TEXT DEFAULT 'retainer';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS estimated_monthly_hours NUMERIC(10,2);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS estimated_project_hours NUMERIC(10,2);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS estimated_budget NUMERIC(12,2);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'lead';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS lead_source TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS expected_close_date DATE;

-- Ticket prefix columns
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ticket_prefix TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS next_ticket_number INTEGER DEFAULT 1;

-- Deactivation tracking
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deactivated_at DATE;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

-- Generate ticket prefixes for clients that don't have one
UPDATE public.clients 
SET ticket_prefix = UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g'), 3))
WHERE ticket_prefix IS NULL AND name IS NOT NULL;

-- Ensure RLS allows authenticated users to insert clients
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON public.clients;
CREATE POLICY "Authenticated users can insert clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
CREATE POLICY "Authenticated users can update clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
CREATE POLICY "Authenticated users can view clients" ON public.clients
  FOR SELECT TO authenticated
  USING (true);

-- Verify columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'clients' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
