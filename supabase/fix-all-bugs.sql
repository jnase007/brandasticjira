-- ============================================
-- FIX ALL REMAINING BUGS
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- BUG 1: MISSING TABLES
-- ============================================

-- Create client_rates table
CREATE TABLE IF NOT EXISTS public.client_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  rate_type TEXT DEFAULT 'hourly',
  rate DECIMAL(10,2) DEFAULT 0,
  effective_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.client_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can view client_rates" ON public.client_rates;
CREATE POLICY "Authenticated can view client_rates" ON public.client_rates
  FOR SELECT TO authenticated USING (true);

-- Create employee_profitability view
CREATE OR REPLACE VIEW public.employee_profitability AS
SELECT 
  p.id as user_id,
  p.full_name,
  p.avatar_url,
  p.cost_rate,
  COALESCE(SUM(te.minutes), 0) / 60.0 as total_hours,
  COALESCE(SUM(te.minutes), 0) / 60.0 * COALESCE(p.cost_rate, 0) as total_cost
FROM profiles p
LEFT JOIN time_entries te ON te.user_id = p.id 
  AND te.created_at >= date_trunc('month', CURRENT_DATE)
WHERE p.role IN ('team', 'admin')
GROUP BY p.id, p.full_name, p.avatar_url, p.cost_rate;

-- Create user_gamification_stats table
CREATE TABLE IF NOT EXISTS public.user_gamification_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  tickets_completed INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  achievements JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_gamification_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can view gamification" ON public.user_gamification_stats;
CREATE POLICY "Authenticated can view gamification" ON public.user_gamification_stats
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can update own gamification" ON public.user_gamification_stats;
CREATE POLICY "Users can update own gamification" ON public.user_gamification_stats
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- BUG 4: DEDUPLICATE PROFILES
-- ============================================

-- Find duplicates
SELECT email, COUNT(*) as count, array_agg(id) as ids
FROM profiles 
WHERE email IS NOT NULL
GROUP BY email 
HAVING COUNT(*) > 1;

-- To fix duplicates, run this for each duplicate email:
-- Keep the one with role='admin' or the oldest one, delete others
-- Example (adjust IDs after checking the query above):
-- DELETE FROM profiles WHERE id IN ('uuid-to-delete-1', 'uuid-to-delete-2');

-- Add unique constraint to prevent future duplicates (after cleaning up)
-- ALTER TABLE profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);

-- ============================================
-- VERIFY
-- ============================================
SELECT 'Bug fixes complete! Check duplicate query results above.' as status;
