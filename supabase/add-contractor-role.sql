-- ============================================
-- Add Contractor Role to Profiles
-- Run this in your Supabase SQL Editor
-- ============================================

-- Drop and recreate the role constraint to include 'contractor'
-- This allows users to be tagged as 1099 contractors vs W-2 employees

ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('team', 'client', 'admin', 'contractor'));

-- Comment for documentation
COMMENT ON COLUMN public.profiles.role IS 'User role: team (W-2 employee), admin (W-2 admin), contractor (1099), client (external client)';
