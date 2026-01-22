-- ============================================
-- PROFILES TABLE UPDATE
-- Adds all new columns for profile features
-- Run this to fix "failed" profile updates!
-- ============================================

-- Add tagline column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tagline TEXT;

-- Add birthday column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS birthday DATE;

-- Add work start date column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS work_start_date DATE;

-- Add show birthday toggle
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS show_birthday BOOLEAN DEFAULT true;

-- Add show age toggle
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS show_age BOOLEAN DEFAULT false;

-- Add hourly cost for profitability tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS hourly_cost DECIMAL(10,2);

-- Add target hours per month
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS target_hours_monthly INTEGER DEFAULT 160;

-- ============================================
-- Verify the columns exist
-- ============================================
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- ============================================
-- DONE!
-- ============================================
SELECT 'Profiles table updated successfully!' as status;
