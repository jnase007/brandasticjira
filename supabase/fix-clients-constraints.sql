-- ============================================
-- FIX CLIENT CONSTRAINTS
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Remove the monthly_hours constraint (allows any value 1-999)
ALTER TABLE public.clients 
DROP CONSTRAINT IF EXISTS clients_monthly_hours_check;

ALTER TABLE public.clients 
ADD CONSTRAINT clients_monthly_hours_check 
CHECK (monthly_hours >= 1 AND monthly_hours <= 999);

-- 2. Allow team members (not just admins) to create/manage clients
DROP POLICY IF EXISTS "Team members can manage clients" ON public.clients;

CREATE POLICY "Team members can manage clients" ON public.clients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

-- 3. Make sure team members can also insert clients
DROP POLICY IF EXISTS "Team members can insert clients" ON public.clients;

CREATE POLICY "Team members can insert clients" ON public.clients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('team', 'admin')
    )
  );

-- Verify the policies are set correctly
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'clients';
